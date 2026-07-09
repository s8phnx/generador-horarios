#!/usr/bin/env python3
"""Convierte un Excel .xls de toma de ramos a data/ramos.json y data/data.js.

Uso:
  pip install xlrd
  python scripts/convert_xls_to_json.py ING_CIVIL_INDUSTRIAL.xls
"""

import json
import os
import re
import sys
import unicodedata
from collections import defaultdict

import xlrd

DAY_MAP = {
    "LU": "Lunes",
    "MA": "Martes",
    "MI": "Miércoles",
    "JU": "Jueves",
    "VI": "Viernes",
    "SA": "Sábado",
    "DO": "Domingo",
}


def time_to_min(t):
    h, m = map(int, t.split(":"))
    return h * 60 + m


def parse_horario(h):
    h = str(h or "").strip()
    meetings = []
    if not h:
        return meetings

    for part in h.split(";"):
        part = part.strip()
        if not part:
            continue
        match = re.search(r"(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})", part)
        if not match:
            continue
        start, end = match.group(1), match.group(2)
        days_part = part[: match.start()].strip()
        day_tokens = [tok for tok in days_part.split() if tok in DAY_MAP]
        for day_code in day_tokens:
            meetings.append(
                {
                    "day": DAY_MAP[day_code],
                    "dayCode": day_code,
                    "start": start,
                    "end": end,
                    "startMin": time_to_min(start),
                    "endMin": time_to_min(end),
                    "time": f"{start} - {end}",
                }
            )
    return meetings


def clean_section_num(s):
    match = re.search(r"(\d+)", str(s))
    return int(match.group(1)) if match else None


def slugify(s):
    s = unicodedata.normalize("NFKD", str(s)).encode("ascii", "ignore").decode("ascii")
    s = re.sub(r"[^a-zA-Z0-9]+", "-", s).strip("-").lower()
    return s or "sin-id"


def read_rows(xls_path):
    book = xlrd.open_workbook(xls_path)
    sheet = book.sheet_by_index(0)
    headers = [str(h).strip() for h in sheet.row_values(0)]
    rows = []
    for r in range(1, sheet.nrows):
        values = sheet.row_values(r)
        row = {headers[i]: values[i] if i < len(values) else "" for i in range(len(headers))}
        for key, value in list(row.items()):
            if isinstance(value, str):
                row[key] = value.strip()
            elif isinstance(value, float) and value.is_integer():
                row[key] = int(value)
        if not any(str(v).strip() for v in row.values()):
            continue
        if not row.get("Asignatura") and not row.get("Nombre Asig."):
            continue
        rows.append(row)
    return rows


def convert(xls_path):
    raw_rows = read_rows(xls_path)
    groups = defaultdict(list)

    for row in raw_rows:
        code = str(row.get("Asignatura", "")).strip()
        package = str(row.get("Paquete", "")).strip()
        section = str(row.get("Sección", "")).strip()
        key = (code, package or f"{code}_{section}_{len(groups)}")
        groups[key].append(row)

    courses = {}
    for (code, package), group_rows in groups.items():
        first = group_rows[0]
        name = str(first.get("Nombre Asig.", "")).strip()
        if not code or not name:
            continue

        credits = first.get("Créditos Asignatura", "")
        try:
            credits = int(credits) if credits != "" else None
        except Exception:
            credits = None

        section_label = str(first.get("Sección", "")).strip()
        section_number = clean_section_num(section_label)
        professors = []
        events = []
        vacancies = None

        for row in group_rows:
            professor = str(row.get("Profesor", "")).strip()
            if professor and professor not in professors:
                professors.append(professor)

            vacancy_value = row.get("Vac. Paquete", "")
            if isinstance(vacancy_value, (int, float)):
                vacancies = int(vacancy_value)
            elif isinstance(vacancy_value, str) and vacancy_value.strip().isdigit():
                vacancies = int(vacancy_value.strip())

            raw_schedule = str(row.get("Horario", "")).strip()
            events.append(
                {
                    "name": str(row.get("Descrip. Evento", "")).strip(),
                    "rawSchedule": raw_schedule,
                    "professor": professor,
                    "meetings": parse_horario(raw_schedule),
                }
            )

        option = {
            "id": slugify(f"{code}-{package}-{section_label}"),
            "package": package,
            "section": section_label,
            "sectionNumber": section_number,
            "category": str(first.get("Cat. Paquete", "")).strip(),
            "campus": str(first.get("Sede", "")).strip(),
            "vacancies": vacancies,
            "professors": professors,
            "events": events,
        }

        if code not in courses:
            courses[code] = {
                "code": code,
                "name": name,
                "credits": credits,
                "references": str(first.get("Asig. Referenciadas", "")).strip(),
                "options": [],
            }
        courses[code]["options"].append(option)

    for course in courses.values():
        course["options"].sort(
            key=lambda o: ((o["sectionNumber"] is None), o["sectionNumber"] or 9999, o["package"])
        )

    courses_list = sorted(courses.values(), key=lambda c: (c["code"], c["name"]))
    slots = {}
    for course in courses_list:
        for option in course["options"]:
            for event in option["events"]:
                for meeting in event["meetings"]:
                    slots[(meeting["startMin"], meeting["endMin"])] = {
                        "start": meeting["start"],
                        "end": meeting["end"],
                        "time": meeting["time"],
                        "startMin": meeting["startMin"],
                        "endMin": meeting["endMin"],
                    }

    return {
        "meta": {
            "sourceFile": os.path.basename(xls_path),
            "generatedFromRows": len(raw_rows),
            "courseCount": len(courses_list),
            "optionCount": sum(len(c["options"]) for c in courses_list),
            "note": "Datos convertidos desde archivo .xls de toma de ramos.",
        },
        "days": ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"],
        "slots": [slots[key] for key in sorted(slots)],
        "courses": courses_list,
    }


def main():
    if len(sys.argv) < 2:
        print("Uso: python scripts/convert_xls_to_json.py archivo.xls")
        sys.exit(1)

    project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
    data_dir = os.path.join(project_root, "data")
    os.makedirs(data_dir, exist_ok=True)

    data = convert(sys.argv[1])

    json_path = os.path.join(data_dir, "ramos.json")
    js_path = os.path.join(data_dir, "data.js")

    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

    with open(js_path, "w", encoding="utf-8") as f:
        f.write("window.COURSE_DATA = ")
        json.dump(data, f, ensure_ascii=False, indent=2)
        f.write(";\n")

    print(f"OK: {data['meta']['courseCount']} ramos y {data['meta']['optionCount']} secciones/paquetes.")
    print(f"Escrito: {json_path}")
    print(f"Escrito: {js_path}")


if __name__ == "__main__":
    main()
