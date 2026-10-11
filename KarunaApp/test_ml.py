import json, subprocess, traceback

# Test con datos que simulan un salon real tipico
payload_real = json.dumps({"alumnos":[
    {"cal_final":72,"prom_tareas":78,"prom_asist":85},
    {"cal_final":65,"prom_tareas":68,"prom_asist":80},
    {"cal_final":58,"prom_tareas":62,"prom_asist":75},
    {"cal_final":81,"prom_tareas":85,"prom_asist":90},
    {"cal_final":45,"prom_tareas":50,"prom_asist":60},
    {"cal_final":70,"prom_tareas":72,"prom_asist":82},
    {"cal_final":88,"prom_tareas":90,"prom_asist":95},
    {"cal_final":42,"prom_tareas":48,"prom_asist":55},
    {"cal_final":76,"prom_tareas":79,"prom_asist":88},
    {"cal_final":55,"prom_tareas":58,"prom_asist":72},
], "umbral":70, "nombre_grupo":"Salon Real"})

# Test con datos escasos (menos de 15 -> modo CV)
payload_escaso = json.dumps({"alumnos":[
    {"cal_final":72,"prom_tareas":78,"prom_asist":85},
    {"cal_final":55,"prom_tareas":60,"prom_asist":70},
    {"cal_final":80,"prom_tareas":82,"prom_asist":90},
    {"cal_final":45,"prom_tareas":48,"prom_asist":60},
    {"cal_final":68,"prom_tareas":70,"prom_asist":78},
    {"cal_final":40,"prom_tareas":45,"prom_asist":55},
    {"cal_final":75,"prom_tareas":80,"prom_asist":88},
    {"cal_final":50,"prom_tareas":52,"prom_asist":65},
], "umbral":70, "nombre_grupo":"Salon Escaso"})

scripts = [("GB", "src/ml/clasificacion_gb.py"), ("LR", "src/ml/clasificacion_lr.py")]

for name, payload in [("10 alumnos", payload_real), ("8 alumnos", payload_escaso)]:
    for mod, script in scripts:
        result = subprocess.run(["python", script], input=payload, capture_output=True, text=True)
        out = result.stdout.strip()
        err = result.stderr.strip()
        print(f"=== [{name}][{mod}] RC={result.returncode} ===")
        if err:
            print(f"STDERR: {err[:500]}")
        if out:
            try:
                d = json.loads(out)
                if d.get("error"):
                    print(f"ERROR JSON: {d['mensaje']}")
                else:
                    print(f"OK modo={d['resumen']['modo']} acc={d['resumen'].get('accuracy')}")
            except Exception as ex:
                print(f"PARSE ERROR: {ex}")
                print(f"RAW OUT: {out[:200]}")
        else:
            print("EMPTY OUTPUT")
        print()
