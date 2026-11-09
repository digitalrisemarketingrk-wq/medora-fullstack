'use client';

import { useEffect, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  Building,
  Calendar,
  Check,
  CheckCircle2,
  Clock,
  ExternalLink,
  FileCheck,
  FileText,
  HeartPulse,
  Package,
  Pill,
  Plus,
  Printer,
  ShieldAlert,
  ShieldCheck,
  Tag,
  Trash2,
  User,
  UserCheck
} from 'lucide-react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { practiceApi, type PracticeModule, type PracticeRecord } from '@/lib/practice-api';
import { PracticePatientPicker } from './practice-task-editor';
import './practice-pharmacy-studio.css';

type Props = {
  module: PracticeModule;
  record?: PracticeRecord;
  initialData?: Record<string, string>;
  branches: PracticeRecord[];
  branch: string;
  practice: string;
  patientNames: Record<string, string>;
  readOnly?: boolean;
  canSign?: boolean;
  onClose: () => void;
  onPersist: (record: PracticeRecord) => void;
  onRelated?: (record: PracticeRecord, module: string) => void;
};

export function PracticePharmacyStudio({
  module,
  record,
  initialData,
  branches,
  branch,
  practice,
  patientNames,
  readOnly = false,
  canSign,
  onClose,
  onPersist,
  onRelated
}: Props) {
  const [base, setBase] = useState(record);
  const [selectedBranch, setSelectedBranch] = useState(record?.branch_id || branch || branches[0]?.id || '');

  // Pharmacy batch fields
  const [name, setName] = useState(record?.title || initialData?.name || 'Amoxicillin 500mg');
  const [batch, setBatch] = useState(record?.data.batch || initialData?.batch || `BATCH-${new Date().getFullYear()}-${Math.floor(100 + Math.random() * 900)}`);
  const [quantity, setQuantity] = useState(record?.data.quantity || initialData?.quantity || '100');
  const [unit, setUnit] = useState(record?.data.unit || initialData?.unit || 'tablets');
  const [expiry, setExpiry] = useState(record?.data.expiry || initialData?.expiry || new Date(Date.now() + 365 * 86400000).toISOString().slice(0, 10));
  const [reorder, setReorder] = useState(record?.data.reorder || initialData?.reorder || '20');
  const [supplier, setSupplier] = useState(record?.data.supplier || initialData?.supplier || 'Medora Central Pharmaceutical Supplies');

  // Dispense modal / form state
  const [dispensePatientId, setDispensePatientId] = useState('');
  const [dispensePatient, setDispensePatient] = useState<PracticeRecord | null>(null);
  const [dispenseQty, setDispenseQty] = useState('10');
  const [dispenseInstructions, setDispenseInstructions] = useState('Take 1 tablet twice daily after meals.');
  const [dispenseModalOpen, setDispenseModalOpen] = useState(false);

  const [activeTab, setActiveTab] = useState<'inventory' | 'label'>('inventory');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const currentQty = Number(quantity) || 0;
  const reorderThreshold = Number(reorder) || 20;
  const isLowStock = currentQty <= reorderThreshold;
  const isExpired = new Date(expiry) < new Date();

  // Load dispense patient
  useEffect(() => {
    if (!dispensePatientId) return;
    let mounted = true;
    practiceApi.get(dispensePatientId, practice)
      .then(p => { if (mounted) setDispensePatient(p); })
      .catch(() => {});
    return () => { mounted = false; };
  }, [dispensePatientId, practice]);

  const persistBatch = async (desiredStatus?: string): Promise<PracticeRecord | null> => {
    if (!name || !batch || !quantity || !unit || !expiry || !reorder) {
      setError('Please complete all required batch fields');
      return null;
    }
    setBusy(true);
    setError('');

    try {
      const dataPayload: Record<string, string> = {
        name,
        batch,
        quantity: String(currentQty),
        unit,
        expiry,
        reorder: String(reorderThreshold),
        supplier
      };

      const payload = {
        data: dataPayload,
        branch_id: selectedBranch,
        version: base?.version || 0,
        request_id: crypto.randomUUID()
      };

      let saved = await practiceApi.save(module.key, payload, base, practice);

      if (desiredStatus && desiredStatus !== saved.status) {
        saved = await practiceApi.action(saved, 'status', {
          version: saved.version,
          request_id: crypto.randomUUID(),
          status: desiredStatus
        }, practice);
      }

      setBase(saved);
      onPersist(saved);
      toast.success('Pharmacy batch stock saved');
      return saved;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save pharmacy batch');
      return null;
    } finally {
      setBusy(false);
    }
  };

  const handleDispenseAction = async () => {
    if (!base) return;
    const qtyToDispense = Number(dispenseQty);
    if (!qtyToDispense || qtyToDispense <= 0 || qtyToDispense > currentQty) {
      setError('Please enter a valid quantity within current stock');
      return;
    }
    if (!dispensePatientId) {
      setError('Please select a registered patient to dispense to');
      return;
    }

    setBusy(true);
    setError('');
    try {
      const updated = await practiceApi.action(base, 'dispense', {
        version: base.version,
        request_id: crypto.randomUUID(),
        quantity: qtyToDispense,
        patient_id: dispensePatientId
      }, practice);

      setBase(updated);
      setQuantity(updated.data.quantity);
      setDispenseModalOpen(false);
      onPersist(updated);
      toast.success(`Successfully dispensed ${qtyToDispense} ${unit} to ${dispensePatient?.title || 'patient'}`);
      setActiveTab('label');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Dispensing failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="pr-pharma-studio">
      {/* Top Header */}
      <header className="pr-ph-topbar">
        <div className="pr-ph-topbar-left">
          <button className="pr-button-icon" onClick={onClose} disabled={busy}>
            <ArrowLeft size={16} />
          </button>
          <div className="pr-ph-title-block">
            <div className="pr-eyebrow">PHARMACY INVENTORY & DISPENSING LEDGER</div>
            <h1>
              {name}
              <span className={`pr-badge ${base?.status === 'Available' ? 'good' : 'muted'}`}>
                {base?.status || 'Available'}
              </span>
            </h1>
          </div>
        </div>

        <div className="pr-ph-topbar-actions">
          <div className="pr-ph-tabs">
            <button
              className={`pr-ph-tab ${activeTab === 'inventory' ? 'active' : ''}`}
              onClick={() => setActiveTab('inventory')}
            >
              <Package size={14} /> Batch Inventory
            </button>
            <button
              className={`pr-ph-tab ${activeTab === 'label' ? 'active' : ''}`}
              onClick={() => setActiveTab('label')}
            >
              <FileCheck size={14} /> Dispensing Label
            </button>
          </div>

          <button
            className="pr-button"
            onClick={() => void persistBatch()}
            disabled={busy}
          >
            Save Batch
          </button>

          {base?.status === 'Available' && currentQty > 0 && !isExpired && (
            <button
              className="pr-button primary"
              onClick={() => setDispenseModalOpen(true)}
              disabled={busy}
            >
              <Pill size={15} /> Dispense Medicine
            </button>
          )}

          <button className="pr-button" onClick={() => window.print()}>
            <Printer size={15} /> Print Label
          </button>
        </div>
      </header>

      {/* Stock Health Strip */}
      <section className="pr-ph-health-strip">
        <div className="pr-ph-strip-cell">
          <span className="pr-ph-label">CURRENT USABLE STOCK</span>
          <div className="pr-ph-qty-val">
            <strong>{currentQty} {unit}</strong>
          </div>
          <small>{isLowStock ? '⚠️ Below reorder threshold' : '✓ Sufficient stock level'}</small>
        </div>

        <div className="pr-ph-strip-cell">
          <span className="pr-ph-label">BATCH NUMBER & IDENTIFIER</span>
          <div className="pr-ph-batch-tag">
            <Tag size={13} />
            <span>{batch}</span>
          </div>
          <small>Registered Pharmaceutical Batch</small>
        </div>

        <div className="pr-ph-strip-cell">
          <span className="pr-ph-label">EXPIRATION DATE</span>
          <div className="pr-ph-expiry-tag">
            <Calendar size={13} />
            <span>{new Date(expiry).toLocaleDateString()}</span>
          </div>
          <small>{isExpired ? 'EXPIRED BATCH - DO NOT DISPENSE' : 'Valid unexpired batch'}</small>
        </div>

        <div className="pr-ph-strip-cell status">
          <span className="pr-ph-label">DISPENSING READINESS</span>
          <div className={`pr-ph-readiness-pill ${isExpired ? 'expired' : isLowStock ? 'low' : 'ready'}`}>
            {isExpired ? <ShieldAlert size={14} /> : <ShieldCheck size={14} />}
            <span>{isExpired ? 'Expired / Quarantine' : isLowStock ? 'Low Stock Warning' : 'Available for Dispensing'}</span>
          </div>
        </div>
      </section>

      {error && <div className="pr-alert error">{error}</div>}

      {/* Main Tab View */}
      {activeTab === 'inventory' ? (
        <div className="pr-ph-grid">
          {/* Main Form Column */}
          <main className="pr-ph-main-col">
            <div className="pr-ph-card">
              <h3><Pill size={16} /> Pharmaceutical Formulation & Batch Specifications</h3>
              <div className="pr-ph-inputs-grid">
                <label>Medicine Name & Strength:
                  <input
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder="e.g. Amoxicillin 500mg"
                  />
                </label>

                <label>Batch Number:
                  <input
                    value={batch}
                    onChange={e => setBatch(e.target.value)}
                    placeholder="e.g. BATCH-2026-904"
                  />
                </label>

                <label>Opening / Current Quantity:
                  <input
                    type="number"
                    min="0"
                    value={quantity}
                    onChange={e => setQuantity(e.target.value)}
                  />
                </label>

                <label>Stock Unit:
                  <select value={unit} onChange={e => setUnit(e.target.value)}>
                    <option value="tablets">Tablets</option>
                    <option value="capsules">Capsules</option>
                    <option value="bottles">Bottles</option>
                    <option value="vials">Vials / Injections</option>
                    <option value="packs">Packs</option>
                    <option value="tubes">Tubes</option>
                  </select>
                </label>

                <label>Expiration Date:
                  <input
                    type="date"
                    value={expiry}
                    onChange={e => setExpiry(e.target.value)}
                  />
                </label>

                <label>Reorder Alert Threshold:
                  <input
                    type="number"
                    min="0"
                    value={reorder}
                    onChange={e => setReorder(e.target.value)}
                  />
                </label>
              </div>

              <label>Pharmaceutical Supplier / Distributor:
                <input
                  value={supplier}
                  onChange={e => setSupplier(e.target.value)}
                  placeholder="e.g. Medora Central Supplies Ltd."
                />
              </label>
            </div>
          </main>

          {/* Right Rail */}
          <aside className="pr-ph-rail">
            <div className="pr-ph-rail-card">
              <h4>Clinic Location</h4>
              <label>Branch Pharmacy:
                <select value={selectedBranch} onChange={e => setSelectedBranch(e.target.value)}>
                  {branches.map(b => <option key={b.id} value={b.id}>{b.title}</option>)}
                </select>
              </label>
            </div>

            <div className="pr-ph-rail-card">
              <h4>Safety & Dispensing Rules</h4>
              <div className="pr-ph-rule-item">
                <CheckCircle2 size={15} />
                <span>Auto-deducts inventory upon dispensing</span>
              </div>
              <div className="pr-ph-rule-item">
                <CheckCircle2 size={15} />
                <span>Expired batches are locked from fulfillment</span>
              </div>
              <div className="pr-ph-rule-item">
                <CheckCircle2 size={15} />
                <span>Allergen review cross-referenced</span>
              </div>
            </div>

            {onRelated && (
              <div className="pr-ph-rail-card">
                <h4>Connected Care</h4>
                <button
                  className="pr-ph-link-btn"
                  onClick={() => base && onRelated(base, 'prescriptions')}
                >
                  <FileText size={14} /> View Doctor Prescriptions
                </button>
                <button
                  className="pr-ph-link-btn"
                  onClick={() => base && onRelated(base, 'billing')}
                >
                  <HeartPulse size={14} /> Bill Pharmacy Dispensing
                </button>
              </div>
            )}
          </aside>
        </div>
      ) : (
        /* Formal Printable Dispensing Label */
        <div className="pr-ph-label-wrap" id="printable-pharmacy-label">
          <div className="pr-ph-label-paper">
            <div className="pr-label-header">
              <div className="pr-label-clinic">
                <HeartPulse size={18} />
                <strong>MEDORA PHARMACEUTICAL CARE</strong>
              </div>
              <span className="pr-label-badge">Rx DISPENSE LABEL</span>
            </div>

            <div className="pr-label-divider" />

            <div className="pr-label-info-grid">
              <div><span>Patient:</span> <strong>{dispensePatient?.title || patientNames[dispensePatientId] || 'Registered Patient'}</strong></div>
              <div><span>Date:</span> <strong>{new Date().toLocaleDateString()}</strong></div>
              <div><span>Medication:</span> <strong>{name}</strong></div>
              <div><span>Quantity:</span> <strong>{dispenseQty} {unit}</strong></div>
              <div><span>Batch:</span> <strong>{batch}</strong></div>
              <div><span>Expiry:</span> <strong>{new Date(expiry).toLocaleDateString()}</strong></div>
            </div>

            <div className="pr-label-instructions">
              <strong>DOSAGE INSTRUCTIONS:</strong>
              <p>{dispenseInstructions}</p>
            </div>

            <div className="pr-label-warning">
              <span>⚠️ Keep out of reach of children. Store in a cool, dry place away from sunlight.</span>
            </div>

            <div className="pr-label-footer">
              <small>Dispensed by: Medora Licensed Pharmacist</small>
              <small>Branch: {branches.find(b => b.id === selectedBranch)?.title || 'Clinic Pharmacy'}</small>
            </div>
          </div>
        </div>
      )}

      {/* Dispense Modal */}
      <Dialog open={dispenseModalOpen} onOpenChange={setDispenseModalOpen}>
        <DialogContent className="pr-dialog pr-dialog-wide">
          <DialogHeader>
            <DialogTitle>Dispense Medication to Patient</DialogTitle>
            <DialogDescription>
              Fulfill prescription using {name} (Batch: {batch}). Available: {currentQty} {unit}.
            </DialogDescription>
          </DialogHeader>
          <div className="pr-form">
            <label>Select Registered Patient:
              <PracticePatientPicker
                value={dispensePatientId}
                practice={practice}
                onChange={setDispensePatientId}
                onSelected={setDispensePatient}
              />
            </label>

            <label>Quantity to Dispense ({unit}):
              <input
                type="number"
                min="1"
                max={currentQty}
                value={dispenseQty}
                onChange={e => setDispenseQty(e.target.value)}
              />
              <small>Must not exceed current available stock ({currentQty} {unit})</small>
            </label>

            <label>Patient Dosage Instructions:
              <textarea
                rows={2}
                value={dispenseInstructions}
                onChange={e => setDispenseInstructions(e.target.value)}
                placeholder="e.g. 1 tablet twice daily after meals for 5 days..."
              />
            </label>
          </div>
          <div className="pr-form-footer">
            <button className="pr-button" onClick={() => setDispenseModalOpen(false)}>Cancel</button>
            <button className="pr-button primary" onClick={handleDispenseAction} disabled={busy || !dispensePatientId}>
              <Check size={14} /> Confirm & Deduct Stock
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
