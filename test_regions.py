import subprocess

regions = ["westus", "westus2", "centralus", "eastus2", "northeurope"]
for r in regions:
    print(f"Testing {r}...")
    subprocess.run(f"az group create -n temp-rg-{r} -l {r}", shell=True, stdout=subprocess.DEVNULL)
    res = subprocess.run(f"az postgres flexible-server create --location {r} --resource-group temp-rg-{r} --name test-pg-{r}-123 --sku-name Standard_B1ms --tier Burstable --admin-user myadmin --admin-password \"Password1234!\" --public-access None", shell=True, capture_output=True, text=True)
    if "restricted" in res.stderr or "ERROR" in res.stderr:
        print(f"{r}: BLOCKED")
    else:
        print(f"{r}: SUCCESS!")
    subprocess.run(f"az group delete -n temp-rg-{r} -y --no-wait", shell=True, stdout=subprocess.DEVNULL)
