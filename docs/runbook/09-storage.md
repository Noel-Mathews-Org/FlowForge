# 09 - Storage and Persistence

**Parent:** [Runbook Index](./00-index.md)

---

## 9.1 The Problem with HostPath Storage

The simplest way to persist data in Kubernetes is `hostPath` volumes, which mount a directory from the worker node's filesystem into the pod. This approach has a fatal flaw: if the pod is rescheduled to a different worker node, it starts without its data. The old data remains on the original node and the pod sees an empty volume on the new node.

For a stateful application like a PostgreSQL database, this is catastrophic and unacceptable.

---

## 9.2 Solution: NFS Server with CSI Driver

FlowForge solves this with a dedicated **NFS Storage Server** EC2 instance at `10.0.1.140`. This server exports a shared directory (`/var/nfs/paycrest`) that is accessible from all nodes in the VPC.

The **NFS CSI Driver** (`nfs.csi.k8s.io`) is installed in the cluster and provides **dynamic volume provisioning**. When a `PersistentVolumeClaim` is created and references the `nfs-csi` StorageClass, the CSI driver automatically creates and mounts an NFS-backed `PersistentVolume` without any manual administrator action.

---

## 9.3 StorageClass Definition

**File:** `k8s-manifest/storageclass.yaml`

```yaml
apiVersion: storage.k8s.io/v1
kind: StorageClass
metadata:
  name: nfs-csi
provisioner: nfs.csi.k8s.io
parameters:
  server: 10.0.1.140
  share: /var/nfs/paycrest
reclaimPolicy: Retain
volumeBindingMode: Immediate
mountOptions:
  - nfsvers=4.1
  - hard
  - timeo=600
  - retrans=2
```

Key parameters:
- `reclaimPolicy: Retain`: When a PVC is deleted, the underlying PV and its data on the NFS server are NOT deleted. This is a safety measure that prevents accidental data loss.
- `volumeBindingMode: Immediate`: A PV is provisioned as soon as the PVC is created, without waiting for a pod to request it.
- `nfsvers=4.1`: NFS version 4.1 is used, which provides better performance and security than NFSv3.
- `hard`: Mount will retry indefinitely if the NFS server is temporarily unreachable. This prevents data corruption from incomplete writes.
- `timeo=600` and `retrans=2`: Network timeout and retry settings for NFS operations.

---

## 9.4 Persistent Volume Claims

Both StatefulSets define PVCs via `volumeClaimTemplates`. Kubernetes automatically creates one PVC per StatefulSet replica.

**PostgreSQL PVC:**

```yaml
volumeClaimTemplates:
- metadata:
    name: postgres-data
  spec:
    accessModes: [ "ReadWriteOnce" ]
    storageClassName: "nfs-csi"
    resources:
      requests:
        storage: 10Gi
```

- PVC name in cluster: `postgres-data-postgres-0`
- Capacity: 10 GiB
- Access mode: `ReadWriteOnce` — can be mounted by one node at a time (appropriate for a single-replica database)

**Redis PVC:**

```yaml
volumeClaimTemplates:
- metadata:
    name: redis-data
  spec:
    accessModes: [ "ReadWriteOnce" ]
    storageClassName: "nfs-csi"
    resources:
      requests:
        storage: 5Gi
```

- PVC name in cluster: `redis-data-redis-0`
- Capacity: 5 GiB
- Redis is started with `--appendonly yes`, enabling AOF (Append-Only File) persistence so event logs survive restarts.

---

## 9.5 Why StatefulSets for Databases

PostgreSQL and Redis are managed as `StatefulSet` resources rather than `Rollout` or `Deployment` resources. StatefulSets provide guarantees that databases require:

1. **Stable network identity:** The pod is always reachable at `postgres-0.postgres.<namespace>.svc.cluster.local`. This DNS name never changes, even if the pod is rescheduled.
2. **Ordered startup/teardown:** Pods start and stop in a defined order (0, then 1, then 2), which is critical for primary-replica database configurations.
3. **Sticky PVC binding:** Each pod index is permanently bound to its own PVC. `postgres-0` always mounts `postgres-data-postgres-0`, never another pod's data.

---

## 9.6 How Self-Healing Works for Databases

If the `postgres-0` pod crashes or is evicted from a worker node:

1. The StatefulSet controller detects the pod is missing.
2. A new `postgres-0` pod is scheduled on an available node.
3. The NFS CSI driver mounts the existing `postgres-data-postgres-0` NFS volume to the new pod.
4. PostgreSQL starts and reads its data from the already-initialized NFS volume.
5. The database is restored to its exact state from before the crash, with no data loss (subject to the `fsync` interval).

---

## 9.7 Database Wipe Procedure (For Environment Re-Initialization)

This procedure is used when a full database reset is required (for example, re-seeding a demo environment).

```bash
# Step 1: Scale the StatefulSet to zero to stop the database process
kubectl scale statefulset postgres -n prod --replicas=0
# Wait for the pod to fully terminate
kubectl get pods -n prod -w

# Step 2: Delete the PVC (this triggers NFS CSI to release the volume)
kubectl delete pvc postgres-data-postgres-0 -n prod

# Step 3: Delete the StatefulSet itself
kubectl delete statefulset postgres -n prod

# Step 4: Allow Argo CD to reconcile
# Argo CD will detect the missing StatefulSet and re-create it from the Helm chart.
# A new PVC will be created and PostgreSQL will run the initdb.sql script
# mounted from the postgres-initdb ConfigMap, re-seeding the databases.
```

The `postgres-initdb` ConfigMap contains the SQL script that creates the four logical databases (`auth_db`, `project_db`, `task_db`, `analytics_db`) and their initial schemas. This is sourced from `infra/initdb.sql`.
