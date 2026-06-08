import os

filepath = r"C:\Users\admin\Desktop\Floforge\FlowForge\.env"
with open(filepath, "r") as f:
    lines = f.readlines()

new_lines = []
for line in lines:
    if line.startswith("DATABASE_URL="):
        continue
    if line.startswith("REDIS_URL="):
        continue
    if line.startswith("SMTP_PASSWORD="):
        continue
    new_lines.append(line)

# Append storage settings
new_lines.append("\n# ------------------------------------------------------------------------------\n")
new_lines.append("# 7. AZURE STORAGE (Passwordless)\n")
new_lines.append("# ------------------------------------------------------------------------------\n")
new_lines.append('AZURE_STORAGE_USE_MANAGED_IDENTITY="true"\n')
new_lines.append('AZURE_STORAGE_ACCOUNT_NAME="<YOUR_STORAGE_ACCOUNT_NAME>"\n')

with open(filepath, "w") as f:
    f.writelines(new_lines)

print("Cleaned up .env")
