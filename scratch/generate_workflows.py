import os

services = [
    ("auth-service", "flowforge-auth", "SONAR_TOKEN_AUTH"),
    ("gateway", "flowforge-gateway", "SONAR_TOKEN_GATEWAY"),
    ("project-service", "flowforge-project", "SONAR_TOKEN_PROJECT"),
    ("task-service", "flowforge-task", "SONAR_TOKEN_TASK"),
    ("analysis-service", "flowforge-analysis", "SONAR_TOKEN_ANALYSIS"),
    ("frontend", "flowforge-frontend", "SONAR_TOKEN_FRONTEND")
]

workflow_dir = ".github/workflows"
os.makedirs(workflow_dir, exist_ok=True)

for service_name, project_key, token_secret in services:
    content = f"""name: {service_name.replace('-', ' ').title()} CI

on:
  push:
    branches:
      - test
    paths:
      - '{service_name}/**'

permissions:
  contents: write
  packages: write

jobs:
  run-ci:
    uses: ./.github/workflows/_ci-reusable.yml
    with:
      service_name: {service_name}
      project_key: {project_key}
    secrets:
      SONAR_TOKEN: ${{{{ secrets.{token_secret} }}}}
      SONAR_HOST_URL: ${{{{ secrets.SONAR_HOST_URL }}}}
      SNYK_TOKEN: ${{{{ secrets.SNYK_TOKEN }}}}
      MAIL_USERNAME: ${{{{ secrets.MAIL_USERNAME }}}}
      MAIL_PASSWORD: ${{{{ secrets.MAIL_PASSWORD }}}}
      DEVELOPMENT_TEAM_EMAIL: ${{{{ secrets.DEVELOPMENT_TEAM_EMAIL }}}}
      GH_PAT: ${{{{ secrets.GH_PAT }}}}
"""
    file_path = os.path.join(workflow_dir, f"ci-{service_name}.yml")
    with open(file_path, "w") as f:
        f.write(content.strip() + "\n")
    print(f"Fixed permissions for {file_path}")
