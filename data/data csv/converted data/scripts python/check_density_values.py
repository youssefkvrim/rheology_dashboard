import os
import re

# Folder containing the .sql files
folder = os.path.dirname(os.path.abspath(__file__))
output_file = os.path.join(folder, "density_check_report.txt")

pattern_density = re.compile(r"density[^,;]*[, ]+([\d.,-]+)", re.IGNORECASE)
pattern_id = re.compile(r"id_rheology\s*=\s*'?([A-Za-z0-9_-]+)'?", re.IGNORECASE)
pattern_insert = re.compile(r"INSERT\s+INTO\s+\w+\s*\((.*?)\)\s*VALUES\s*\((.*?)\);", re.IGNORECASE | re.DOTALL)

with open(output_file, "w", encoding="utf-8") as report:
    report.write("Density > 10 check report\n")
    report.write("=" * 40 + "\n\n")

    sql_files = [f for f in os.listdir(folder) if f.lower().endswith(".sql")]

    if not sql_files:
        report.write("No .sql files found.\n")
    else:
        for filename in sql_files:
            file_path = os.path.join(folder, filename)
            try:
                with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
                    content = f.read()

                found_issues = []
                for insert in pattern_insert.finditer(content):
                    cols = insert.group(1).split(",")
                    vals = insert.group(2).split(",")

                    # Clean up values
                    cols = [c.strip().lower() for c in cols]
                    vals = [v.strip().strip("'") for v in vals]

                    data = dict(zip(cols, vals))

                    if "density" in data:
                        try:
                            val = float(data["density"].replace(",", "."))
                            if val > 10:
                                id_rheo = data.get("id_rheology", "UNKNOWN")
                                found_issues.append((id_rheo, val))
                        except ValueError:
                            continue

                if found_issues:
                    report.write(f"\nFile: {filename}\n")
                    report.write("-" * 30 + "\n")
                    for id_rheo, val in found_issues:
                        report.write(f"id_rheology: {id_rheo} | density: {val}\n")

            except Exception as e:
                report.write(f"Error reading {filename}: {e}\n")

print(f"✅ Check complete. Report saved to: {output_file}")
