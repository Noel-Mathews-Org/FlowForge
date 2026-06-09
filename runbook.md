# 📘 FlowForge ArgoCD & AKS Runbook

This runbook provides the exact step-by-step commands to install ArgoCD onto your brand new Azure Dev cluster, access the visual dashboard, and automatically deploy the entire FlowForge application.

---

## Step 1: Connect to your AKS Cluster
First, authenticate your terminal with your Azure account and download the cluster credentials so `kubectl` knows where to send commands.

```bash
az login
az account set --subscription "<YOUR_SUBSCRIPTION_ID>"

# Download the kubeconfig for your Dev Cluster
az aks get-credentials --resource-group rg-flowforge-dev --name aks-dev --overwrite-existing
```

---

## Step 2: Install ArgoCD
ArgoCD lives in its own dedicated namespace. We will create the namespace and install the core ArgoCD controllers and services.

```bash
# Create the namespace
kubectl create namespace argocd

# Install the latest stable version of ArgoCD
kubectl apply -n argocd -f https://raw.githubusercontent.com/argoproj/argo-cd/stable/manifests/install.yaml
```
*Wait a minute or two for the pods to spin up. You can check their status by running: `kubectl get pods -n argocd`*

---

## Step 3: Access the ArgoCD Dashboard
To view the beautiful ArgoCD web UI, we need to securely port-forward the dashboard service to your local machine.

1. **Retrieve the auto-generated Admin Password:**
   Run this command to decode the default password ArgoCD generated for the `admin` user:
   ```bash
   kubectl -n argocd get secret argocd-initial-admin-secret -o jsonpath="{.data.password}" | ForEach-Object { [System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String($_)) }
   ```
   *(Copy this password down!)*

2. **Start the Port Forward:**
   ```bash
   kubectl port-forward svc/argocd-server -n argocd 8080:443
   ```

3. **Login:**
   - Open your browser and go to: `https://localhost:8080`
   - *Note: Your browser will warn you about an insecure certificate (because it's localhost). Click "Advanced" -> "Proceed to localhost".*
   - **Username:** `admin`
   - **Password:** *(The password you copied from Step 1)*

---

## Step 4: Install Cert-Manager for Free SSL
To get a green padlock (`https://`) on your domain so Microsoft Entra ID will allow authentication, we use cert-manager to automatically pull Let's Encrypt certificates.

1. **Install Cert-Manager:**
   ```bash
   kubectl apply -f https://github.com/cert-manager/cert-manager/releases/download/v1.16.1/cert-manager.yaml
   ```
   *(Wait about 60 seconds for the cert-manager pods to spin up: `kubectl get pods -n cert-manager`)*

2. **Create the Let's Encrypt ClusterIssuer:**
   Save this to a file named `issuer.yaml` and apply it:
   ```yaml
   apiVersion: cert-manager.io/v1
   kind: ClusterIssuer
   metadata:
     name: letsencrypt-prod
   spec:
     acme:
       server: https://acme-v02.api.letsencrypt.org/directory
       email: bloodymaryy77@gmail.com
       privateKeySecretRef:
         name: letsencrypt-prod
       solvers:
       - http01:
           ingress:
             class: azure/application-gateway
   ```
   Apply it: `kubectl apply -f issuer.yaml`

---

## Step 5: Deploy the FlowForge Application
Now that ArgoCD is running, we will tell it to monitor your GitHub repository and automatically deploy all the Helm charts into the cluster!

Open a **new terminal window** (keep the port-forward command running in the first one) and run:

```bash
# Apply the GitOps Manifest we created earlier
kubectl apply -f argocd/argocd-dev-app.yaml
```

### What happens next?
1. Go back to your ArgoCD Dashboard in the browser.
2. You will instantly see a new Application tile called `flowforge-dev`.
3. Click on it, and you will see a massive, beautiful tree diagram of all your pods, services, and ingress controllers automatically spinning up!
4. From now on, whenever your CI/CD pipeline pushes a new image tag to GitHub, ArgoCD will detect it and automatically update the cluster.
