import os
import re

base_dir = r"C:\Users\admin\Desktop\Floforge\FlowForge\terraform"

# 1. Fix variables.tf syntax in all module directories
def fix_variables_file(filepath):
    with open(filepath, 'r') as f:
        content = f.read()
    
    # Replace single line blocks with multi-line blocks
    # e.g. variable "name" { type = string default = "val" }
    lines = content.split('\n')
    new_lines = []
    for line in lines:
        match = re.match(r'variable\s+"([^"]+)"\s*\{\s*(.*)\s*\}', line)
        if match:
            var_name = match.group(1)
            inner = match.group(2)
            new_lines.append(f'variable "{var_name}" {{')
            if 'type = list(string)' in inner:
                new_lines.append('  type = list(string)')
            elif 'type = string' in inner:
                new_lines.append('  type = string')
            
            default_match = re.search(r'default\s*=\s*(.*)', inner)
            if default_match:
                new_lines.append(f'  default = {default_match.group(1)}')
                
            new_lines.append('}')
        else:
            new_lines.append(line)
            
    with open(filepath, 'w') as f:
        f.write('\n'.join(new_lines))

for root, _, files in os.walk(base_dir):
    for file in files:
        if file == 'variables.tf':
            fix_variables_file(os.path.join(root, file))

# 2. Fix AKS enable_auto_scaling to auto_scaling_enabled
aks_main = os.path.join(base_dir, r"azure\modules\aks\main.tf")
if os.path.exists(aks_main):
    with open(aks_main, 'r') as f:
        content = f.read()
    content = content.replace("enable_auto_scaling = true", "auto_scaling_enabled = true")
    with open(aks_main, 'w') as f:
        f.write(content)

# 3. Fix Front Door certificate_name_check_enabled
fd_main = os.path.join(base_dir, r"azure\modules\front_door\main.tf")
if os.path.exists(fd_main):
    with open(fd_main, 'r') as f:
        content = f.read()
    if "certificate_name_check_enabled" not in content:
        content = content.replace("origin_host_header             = var.appgw_public_ip_address", 
                                  "origin_host_header             = var.appgw_public_ip_address\n  certificate_name_check_enabled = false")
    with open(fd_main, 'w') as f:
        f.write(content)

# 4. Fix VPN enable_bgp
vpn_main = os.path.join(base_dir, r"azure\modules\vpn\main.tf")
if os.path.exists(vpn_main):
    with open(vpn_main, 'r') as f:
        content = f.read()
    # Remove enable_bgp from azurerm_virtual_network_gateway_connection
    lines = content.split('\n')
    new_lines = []
    in_conn = False
    for line in lines:
        if "resource \"azurerm_virtual_network_gateway_connection\"" in line:
            in_conn = True
        if in_conn and "enable_bgp" in line:
            continue # skip this line
        if in_conn and line.strip() == "}":
            in_conn = False
        new_lines.append(line)
    with open(vpn_main, 'w') as f:
        f.write('\n'.join(new_lines))

# 5. Fix Provider version in Azure root to ~> 4.0
az_provider = os.path.join(base_dir, r"azure\providers.tf")
if os.path.exists(az_provider):
    with open(az_provider, 'r') as f:
        content = f.read()
    content = content.replace('version = "~> 3.0"', 'version = "~> 4.0"')
    with open(az_provider, 'w') as f:
        f.write(content)

# 6. Setup dev and prod tfvars
import shutil
az_tfvars = os.path.join(base_dir, r"azure\terraform.tfvars")
if os.path.exists(az_tfvars):
    shutil.copy(az_tfvars, os.path.join(base_dir, r"azure\dev.tfvars"))
    shutil.copy(az_tfvars, os.path.join(base_dir, r"azure\prod.tfvars"))

aws_tfvars = os.path.join(base_dir, r"aws\terraform.tfvars")
if os.path.exists(aws_tfvars):
    shutil.copy(aws_tfvars, os.path.join(base_dir, r"aws\dev.tfvars"))
    shutil.copy(aws_tfvars, os.path.join(base_dir, r"aws\prod.tfvars"))
