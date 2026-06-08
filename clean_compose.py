import os
import re

filepath = r"C:\Users\admin\Desktop\Floforge\FlowForge\docker-compose.yml"
with open(filepath, "r") as f:
    lines = f.readlines()

new_lines = []
for line in lines:
    if "DATABASE_URL" in line or "REDIS_URL" in line:
        continue
    new_lines.append(line)

with open(filepath, "w") as f:
    f.writelines(new_lines)

print("Removed DATABASE_URL and REDIS_URL from docker-compose.yml")
