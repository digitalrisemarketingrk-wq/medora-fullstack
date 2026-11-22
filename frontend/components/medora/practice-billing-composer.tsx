'use client';

import { useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  CreditCard,
  DollarSign,
  Download,
  FileCheck2,
  FileText,
  HeartPulse,
  Info,
  MapPin,
  Plus,
  Printer,
  Receipt,
  RotateCcw,
  ShieldCheck,
  Trash2,
  UserRound,
  Wallet
} from 'lucide-react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ApiError } from '@/lib/medora-api';
import { practiceApi, type PracticeModule, type PracticeRecord } from '@/lib/practice-api';
import { PracticePatientPicker } from './practice-task-editor';
import './practice-billing-composer.css';

export interface BillingLineItem {
  id: string;
  description: string;
  category: 'Consultation' | 'Diagnostic' | 'Pharmacy' | 'Procedure' | 'Nursing' | 'Other';
  quantity: number;
  rate: number;
  total: number;
}

const SERVICE_PRESETS: { label: string; desc: string; category: BillingLineItem['category']; rate: number }[] = [
  { label: 'General Consultation', desc: 'Standard GP clinical consultation (30 min)', category: 'Consultation', rate: 600 },
  { label: 'Specialist Consultation', desc: 'Consultant physician evaluation (45 min)', category: 'Consultation', rate: 1200 },
  { label: 'Follow-up Review', desc: 'Post-treatment progress consultation', category: 'Consultation', rate: 400 },
  { label: '12-Lead ECG Diagnostic', desc: 'Standard resting 12-lead electrocardiogram', category: 'Diagnostic', rate: 450 },
  { label: 'Complete Blood Count (CBC)', desc: 'Full automated haemogram panel', category: 'Diagnostic', rate: 350 },
  { label: 'Comprehensive Metabolic Panel', desc: 'Liver, renal and electrolyte profile', category: 'Diagnostic', rate: 850 },
  { label: 'Pharmacy Medication Dispensing', desc: 'Prescription medications & consumables', category: 'Pharmacy', rate: 380 },
  { label: 'Minor Dressing & Nursing', desc: 'Aseptic wound dressing and nursing care', category: 'Nursing', rate: 250 }
];

const CURRENCIES = [
  { code: 'INR', symbol: '₹', name: 'Indian Rupee (INR)' }
];

const TAX_RATES = [
  { label: 'Exempt / None (0%)', value: 0 },
  { label: 'Healthcare GST (5%)', value: 0.05 },
  { label: 'Diagnostics GST (12%)', value: 0.12 },
  { label: 'Pharmacy GST (18%)', value: 0.18 }
];

export type PracticeBillingComposerProps = {
  module: PracticeModule;
  record?: PracticeRecord;
  initialData?: Record<string, string>;
  branches: PracticeRecord[];
  branch: string;
  practice: string;
  patientNames: Record<string, string>;
  readOnly?: boolean;
  onClose: () => void;
  onPersist: (record: PracticeRecord) => void;
  onRelated?: (record: PracticeRecord, module: string) => void;
};

function formatCurrency(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat('en', { style: 'currency', currency, minimumFractionDigits: 2 }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(2)}`;
  }
}

function parseBillingNotes(notes?: string): { items: BillingLineItem[]; taxRate: number; discount: number; noteText: string } {
  const defaultRes = {
    items: [
      {
        id: crypto.randomUUID(),
        description: 'General Clinical Consultation',
        category: 'Consultation' as const,
        quantity: 1,
        rate: 600,
        total: 600
      }
    ],
    taxRate: 0,
    discount: 0,
    noteText: ''
  };

  if (!notes) return defaultRes;

  try {
    const jsonMatch = notes.match(/<!--BILLING_DATA:([\s\S]*?)-->/);
    if (jsonMatch && jsonMatch[1]) {
      const parsed = JSON.parse(jsonMatch[1]);
      if (parsed && Array.isArray(parsed.items) && parsed.items.length > 0) {
        return {
          items: parsed.items,
          taxRate: typeof parsed.taxRate === 'number' ? parsed.taxRate : 0,
          discount: typeof parsed.discount === 'number' ? parsed.discount : 0,
          noteText: parsed.noteText || ''
        };
      }
    }
  } catch {
    // fallback
  }

  return { ...defaultRes, noteText: notes.replace(/<!--BILLING_DATA:[\s\S]*?-->/, '').trim() };
}

function serializeBillingNotes(items: BillingLineItem[], taxRate: number, discount: number, userNote: string): string {
  const itemLines = items.map((item, idx) => `${idx + 1}. ${item.description} (${item.category}) × ${item.quantity} @ ${item.rate.toFixed(2)} = ${item.total.toFixed(2)}`);
  const textSummary = `Itemized Services:\n${itemLines.join('\n')}${userNote ? '\n\nNotes:\n' + userNote : ''}`;
  const metadata = `\n\n<!--BILLING_DATA:${JSON.stringify({ items, taxRate, discount, noteText: userNote })}-->`;
  return textSummary + metadata;
}

export function PracticeBillingComposer({
  module,
  record,
  initialData,
  branches,
  branch,
  practice,
  patientNames,
  readOnly = false,
  onClose,
  onPersist,
  onRelated
}: PracticeBillingComposerProps) {
  const [base, setBase] = useState(record);
  const [patientId, setPatientId] = useState(record?.data.patient_id || initialData?.patient_id || '');
  const [patient, setPatient] = useState<PracticeRecord | null>(null);
  const [title, setTitle] = useState(record?.data.title || initialData?.title || 'Medical Consultation Invoice');
  const [selectedBranch, setSelectedBranch] = useState(record?.branch_id || branch || branches.find(b => b.status === 'Active')?.id || '');
  const [currency, setCurrency] = useState(record?.data.currency || initialData?.currency || 'INR');
  const [dueDate, setDueDate] = useState(record?.data.due_date || initialData?.due_date || new Date().toISOString().slice(0, 10));

  const parsedData = parseBillingNotes(record?.data.notes || initialData?.notes);
  const [items, setItems] = useState<BillingLineItem[]>(parsedData.items);
  const [taxRate, setTaxRate] = useState<number>(parsedData.taxRate);
  const [discount, setDiscount] = useState<number>(parsedData.discount);
  const [userNote, setUserNote] = useState<string>(parsedData.noteText || 'Payment due on receipt. Thank you for choosing Medora.');

  const [activeTab, setActiveTab] = useState<'composer' | 'preview'>('composer');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [payDialogOpen, setPayDialogOpen] = useState(false);
  const [payAmount, setPayAmount] = useState('');
  const [payMethod, setPayMethod] = useState('Credit/Debit Card');

  const attempt = useRef<{ fingerprint: string; id: string } | null>(null);
  const isFinalized = readOnly || base?.status === 'Void';

  const currentBranch = branches.find(b => b.id === selectedBranch);

  // Subtotals and financial calculation
  const subtotal = items.reduce((acc, item) => acc + item.total, 0);
  const taxAmount = subtotal * taxRate;
  const grandTotal = Math.max(0, subtotal + taxAmount - discount);
  const paidAmount = Number(base?.data._paid_minor || 0) / 100;
  const outstandingBalance = Math.max(0, grandTotal - paidAmount);

  // Load patient details
  useEffect(() => {
    let active = true;
    if (!patientId) {
      setPatient(null);
      return;
    }
    practiceApi.get(patientId, practice)
      .then(p => {
        if (active) setPatient(p);
      })
      .catch(() => {
        // silent fallback
      });
    return () => { active = false; };
  }, [patientId, practice]);

  const addLineItem = (preset?: typeof SERVICE_PRESETS[0]) => {
    if (isFinalized) return;
    const newItem: BillingLineItem = preset ? {
      id: crypto.randomUUID(),
      description: preset.label,
      category: preset.category,
      quantity: 1,
      rate: preset.rate,
      total: preset.rate
    } : {
      id: crypto.randomUUID(),
      description: '',
      category: 'Consultation',
      quantity: 1,
      rate: 500,
      total: 500
    };
    setItems(prev => [...prev, newItem]);
  };

  const removeLineItem = (id: string) => {
    if (isFinalized) return;
    setItems(prev => prev.filter(i => i.id !== id));
  };

  const updateLineItem = (id: string, updates: Partial<BillingLineItem>) => {
    if (isFinalized) return;
    setItems(prev => prev.map(i => {
      if (i.id !== id) return i;
      const updated = { ...i, ...updates };
      const qty = updated.quantity || 1;
      const rate = updated.rate || 0;
      updated.total = qty * rate;
      return updated;
    }));
  };

  const setDueDatePreset = (days: number) => {
    const d = new Date();
    d.setDate(d.getDate() + days);
    setDueDate(d.toISOString().slice(0, 10));
  };

  async function persist(targetStatus?: string): Promise<PracticeRecord | null> {
    if (!patientId) {
      setError('Please choose a patient for this invoice.');
      return null;
    }
    if (items.length === 0 || items.every(i => !i.description.trim())) {
      setError('Please add at least one line item with a valid description.');
      return null;
    }
    if (!selectedBranch) {
      setError('Please select a clinic branch.');
      return null;
    }

    setBusy(true);
    setError('');

    try {
      const serializedNotes = serializeBillingNotes(items.filter(i => i.description.trim()), taxRate, discount, userNote);
      const formattedAmount = grandTotal.toFixed(2);

      const payload = {
        data: {
          patient_id: patientId,
          title: title.trim() || `Invoice - ${patient?.title || 'Patient'}`,
          amount: formattedAmount,
          currency: currency,
          due_date: dueDate,
          notes: serializedNotes
        },
        branch_id: selectedBranch,
        version: base?.version || 0
      };

      const fingerprint = JSON.stringify(payload);
      if (attempt.current?.fingerprint !== fingerprint) {
        attempt.current = { fingerprint, id: crypto.randomUUID() };
      }

      let saved = await practiceApi.save(module.key, { ...payload, request_id: attempt.current.id }, base, practice);

      if (targetStatus && targetStatus !== saved.status && module.transitions[saved.status]?.includes(targetStatus)) {
        saved = await practiceApi.action(saved, 'status', {
          version: saved.version,
          request_id: crypto.randomUUID(),
          status: targetStatus
        }, practice);
      }

      setBase(saved);
      toast.success(targetStatus === 'Issued' ? 'Invoice issued successfully' : 'Invoice draft saved');
      onPersist(saved);
      return saved;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save invoice. Please review input.');
      return null;
    } finally {
      setBusy(false);
    }
  }

  const handleRecordPayment = async () => {
    if (!base) return;
    const amountVal = Number(payAmount);
    if (!amountVal || amountVal <= 0 || amountVal > outstandingBalance) {
      toast.error(`Please enter an amount between 0.01 and ${formatCurrency(outstandingBalance, currency)}.`);
      return;
    }

    setBusy(true);
    try {
      const updated = await practiceApi.action(base, 'pay', {
        version: base.version,
        request_id: crypto.randomUUID(),
        amount: payAmount
      }, practice);

      setBase(updated);
      setPayDialogOpen(false);
      setPayAmount('');
      toast.success(`Payment of ${formatCurrency(amountVal, currency)} recorded successfully!`);
      onPersist(updated);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not record payment.');
    } finally {
      setBusy(false);
    }
  };

  const patientName = patient?.title || patientNames[patientId] || 'Patient';

  return (
    <div className="pr-bill-studio" aria-label="Billing & Invoice Composer">
      {/* Header Bar */}
      <div className="pr-bill-header">
        <div className="pr-bill-header-left">
          <button className="pr-bill-back-btn" onClick={onClose} disabled={busy}>
            <ArrowLeft size={16} />
            <span>Back to records</span>
          </button>
          <div className="pr-bill-title-group">
            <div className="pr-bill-badge-row">
              <span className="pr-bill-kicker">FINANCIAL REVENUE CYCLE</span>
              <span className={`pr-bill-status ${base?.status === 'Paid' ? 'paid' : base?.status === 'Part-paid' ? 'part-paid' : base?.status === 'Issued' ? 'issued' : 'draft'}`}>
                <span className="pr-bill-dot" />
                {base?.status || 'Unsaved Draft'}
              </span>
            </div>
            <h1>{title || 'Medical Invoice'}</h1>
          </div>
        </div>

        <div className="pr-bill-header-actions">
          <div className="pr-bill-tab-group">
            <button
              className={`pr-bill-tab ${activeTab === 'composer' ? 'active' : ''}`}
              onClick={() => setActiveTab('composer')}
            >
              <Wallet size={15} />
              <span>Invoice Composer</span>
            </button>
            <button
              className={`pr-bill-tab ${activeTab === 'preview' ? 'active' : ''}`}
              onClick={() => setActiveTab('preview')}
            >
              <Receipt size={15} />
              <span>Invoice Document</span>
            </button>
          </div>

          {!isFinalized && base?.status !== 'Issued' && base?.status !== 'Paid' && base?.status !== 'Part-paid' && (
            <button
              className="pr-button pr-bill-save-draft"
              disabled={busy}
              onClick={() => void persist()}
            >
              {busy ? 'Saving…' : 'Save Draft'}
            </button>
          )}

          {!isFinalized && (!base || base.status === 'Draft') && (
            <button
              className="pr-button primary pr-bill-issue-btn"
              disabled={busy || !patientId || items.length === 0}
              onClick={() => void persist('Issued')}
            >
              <CheckCircle2 size={16} />
              <span>Issue Invoice</span>
            </button>
          )}

          {base && ['Issued', 'Part-paid'].includes(base.status) && (
            <button
              className="pr-button primary pr-bill-pay-btn"
              onClick={() => {
                setPayAmount(outstandingBalance.toFixed(2));
                setPayDialogOpen(true);
              }}
            >
              <CreditCard size={16} />
              <span>Record Payment</span>
            </button>
          )}

          <button
            className="pr-button pr-bill-print-btn"
            onClick={() => window.print()}
          >
            <Printer size={16} />
            <span>Print Invoice</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="pr-alert error" role="alert">
          <AlertTriangle size={18} />
          <div>
            <strong>Billing Notice</strong>
            <p>{error}</p>
          </div>
        </div>
      )}

      {/* Patient & Financial Account Strip */}
      <div className="pr-bill-account-strip">
        <div className="pr-bill-patient-card">
          <span className="pr-bill-avatar">
            <UserRound size={22} />
          </span>
          <div className="pr-bill-patient-info">
            <div className="pr-bill-patient-name-row">
              <strong>{patientName}</strong>
              {patient?.data.email && <span className="pr-bill-meta-tag">{patient.data.email}</span>}
              {patient?.data.phone && <span className="pr-bill-meta-tag">{patient.data.phone}</span>}
            </div>
            <small>{patient ? `Patient Account Ref: ${patient.id.slice(0, 8)}` : 'Select patient for billing'}</small>
          </div>
          {!isFinalized && !record && (
            <div className="pr-bill-patient-picker-wrap">
              <PracticePatientPicker
                value={patientId}
                practice={practice}
                disabled={busy}
                onChange={setPatientId}
                onSelected={setPatient}
              />
            </div>
          )}
        </div>

        <div className="pr-bill-metric-card">
          <span className="pr-bill-metric-label">TOTAL INVOICED</span>
          <strong>{formatCurrency(grandTotal, currency)}</strong>
          <small>{items.length} billable service item{items.length === 1 ? '' : 's'}</small>
        </div>

        <div className={`pr-bill-metric-card ${outstandingBalance > 0 ? 'outstanding' : 'cleared'}`}>
          <span className="pr-bill-metric-label">OUTSTANDING BALANCE</span>
          <strong>{formatCurrency(outstandingBalance, currency)}</strong>
          <small>{paidAmount > 0 ? `Paid: ${formatCurrency(paidAmount, currency)}` : 'Unpaid'}</small>
        </div>

        <div className="pr-bill-branch-card">
          <span className="pr-bill-branch-label"><MapPin size={13} /> BILLING LOCATION</span>
          <select
            value={selectedBranch}
            disabled={isFinalized || busy}
            onChange={e => setSelectedBranch(e.target.value)}
          >
            {branches.map(b => (
              <option key={b.id} value={b.id}>{b.title}</option>
            ))}
          </select>
          <small>{currentBranch?.data.timezone || 'Timezone active'}</small>
        </div>
      </div>

      {/* Main Billing Body */}
      <div className="pr-bill-main-body">
        {activeTab === 'composer' ? (
          <div className="pr-bill-composer-grid">
            <div className="pr-bill-left-pane">
              {/* Invoice Meta Settings */}
              <div className="pr-bill-panel pr-bill-meta-panel">
                <div className="pr-bill-panel-header">
                  <h2>Invoice Parameters</h2>
                  <span className="pr-bill-sub">Currency, due date & reference title</span>
                </div>
                <div className="pr-bill-meta-fields">
                  <label className="pr-bill-field-wide">
                    Invoice Title / Reference
                    <input
                      type="text"
                      value={title}
                      disabled={isFinalized || busy}
                      placeholder="e.g. Outpatient Consultation & Diagnostics"
                      onChange={e => setTitle(e.target.value)}
                    />
                  </label>

                  <label>
                    Currency
                    <select
                      value={currency}
                      disabled={isFinalized || busy}
                      onChange={e => setCurrency(e.target.value)}
                    >
                      {CURRENCIES.map(c => (
                        <option key={c.code} value={c.code}>{c.symbol} {c.code} · {c.name}</option>
                      ))}
                    </select>
                  </label>

                  <label>
                    Payment Due Date
                    <input
                      type="date"
                      value={dueDate}
                      disabled={isFinalized || busy}
                      onChange={e => setDueDate(e.target.value)}
                    />
                  </label>
                </div>

                {!isFinalized && (
                  <div className="pr-bill-due-presets">
                    <span>Due Presets:</span>
                    <button type="button" onClick={() => setDueDatePreset(0)}>Due on Receipt</button>
                    <button type="button" onClick={() => setDueDatePreset(15)}>Net 15 Days</button>
                    <button type="button" onClick={() => setDueDatePreset(30)}>Net 30 Days</button>
                  </div>
                )}
              </div>

              {/* Line Items Section */}
              <div className="pr-bill-panel pr-bill-items-panel">
                <div className="pr-bill-panel-header">
                  <div>
                    <h2>Line Items & Service Charges ({items.length})</h2>
                    <span className="pr-bill-sub">Itemized clinical procedures, visits, and pharmacy items</span>
                  </div>
                  {!isFinalized && (
                    <button
                      className="pr-button pr-bill-add-row-btn"
                      onClick={() => addLineItem()}
                      disabled={busy}
                    >
                      <Plus size={15} />
                      <span>Add Item</span>
                    </button>
                  )}
                </div>

                {/* Quick Add Palette */}
                {!isFinalized && (
                  <div className="pr-bill-quick-palette">
                    <span className="pr-bill-palette-title">Quick Add Services:</span>
                    <div className="pr-bill-palette-chips">
                      {SERVICE_PRESETS.map(preset => (
                        <button
                          key={preset.label}
                          type="button"
                          className="pr-bill-chip"
                          onClick={() => addLineItem(preset)}
                        >
                          <Plus size={12} />
                          <span>{preset.label} ({formatCurrency(preset.rate, currency)})</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Line Items Table */}
                <div className="pr-bill-table-wrapper">
                  <table className="pr-bill-items-table">
                    <thead>
                      <tr>
                        <th style={{ width: '40px' }}>#</th>
                        <th>Service / Item Description</th>
                        <th style={{ width: '130px' }}>Category</th>
                        <th style={{ width: '80px' }}>Qty</th>
                        <th style={{ width: '120px' }}>Unit Rate ({currency})</th>
                        <th style={{ width: '120px' }}>Amount</th>
                        {!isFinalized && <th style={{ width: '40px' }}><span className="pr-sr-only">Delete</span></th>}
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((item, index) => (
                        <tr key={item.id}>
                          <td className="pr-bill-num-col">{index + 1}</td>
                          <td>
                            <input
                              type="text"
                              className="pr-bill-table-input"
                              value={item.description}
                              disabled={isFinalized || busy}
                              placeholder="Service or consultation description"
                              onChange={e => updateLineItem(item.id, { description: e.target.value })}
                            />
                          </td>
                          <td>
                            <select
                              className="pr-bill-table-select"
                              value={item.category}
                              disabled={isFinalized || busy}
                              onChange={e => updateLineItem(item.id, { category: e.target.value as any })}
                            >
                              <option value="Consultation">Consultation</option>
                              <option value="Diagnostic">Diagnostic</option>
                              <option value="Pharmacy">Pharmacy</option>
                              <option value="Procedure">Procedure</option>
                              <option value="Nursing">Nursing</option>
                              <option value="Other">Other</option>
                            </select>
                          </td>
                          <td>
                            <input
                              type="number"
                              min="1"
                              step="1"
                              className="pr-bill-table-input num-align"
                              value={item.quantity}
                              disabled={isFinalized || busy}
                              onChange={e => updateLineItem(item.id, { quantity: Math.max(1, parseInt(e.target.value) || 1) })}
                            />
                          </td>
                          <td>
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              className="pr-bill-table-input num-align"
                              value={item.rate}
                              disabled={isFinalized || busy}
                              onChange={e => updateLineItem(item.id, { rate: Math.max(0, parseFloat(e.target.value) || 0) })}
                            />
                          </td>
                          <td className="pr-bill-amount-col">
                            <strong>{formatCurrency(item.total, currency)}</strong>
                          </td>
                          {!isFinalized && (
                            <td>
                              <button
                                type="button"
                                className="pr-bill-row-delete"
                                onClick={() => removeLineItem(item.id)}
                                aria-label="Delete line"
                              >
                                <Trash2 size={15} />
                              </button>
                            </td>
                          )}
                        </tr>
                      ))}

                      {items.length === 0 && (
                        <tr>
                          <td colSpan={7} className="pr-bill-empty-table">
                            <Receipt size={28} />
                            <p>No line items added yet.</p>
                            <button className="pr-button primary" onClick={() => addLineItem()}>
                              <Plus size={14} /> Add First Item
                            </button>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Terms and Payment Notes */}
              <div className="pr-bill-panel pr-bill-notes-panel">
                <div className="pr-bill-panel-header">
                  <h2>Payment Terms & Notes</h2>
                  <span className="pr-bill-sub">Instructions printed on the invoice</span>
                </div>
                <textarea
                  rows={3}
                  value={userNote}
                  disabled={isFinalized || busy}
                  placeholder="Provide payment bank details, insurance coverage remarks or refund policy..."
                  onChange={e => setUserNote(e.target.value)}
                />
              </div>
            </div>

            {/* Right Pane: Totals Rail & Actions */}
            <div className="pr-bill-right-pane">
              <div className="pr-bill-totals-card">
                <h3>INVOICE TOTALS</h3>

                <div className="pr-bill-summary-row">
                  <span>Subtotal</span>
                  <strong>{formatCurrency(subtotal, currency)}</strong>
                </div>

                <div className="pr-bill-tax-row">
                  <div className="pr-bill-tax-label">
                    <span>Tax / Regulatory Fee</span>
                    <select
                      value={taxRate}
                      disabled={isFinalized || busy}
                      onChange={e => setTaxRate(parseFloat(e.target.value))}
                    >
                      {TAX_RATES.map(tr => (
                        <option key={tr.value} value={tr.value}>{tr.label}</option>
                      ))}
                    </select>
                  </div>
                  <span>{formatCurrency(taxAmount, currency)}</span>
                </div>

                <div className="pr-bill-discount-row">
                  <div className="pr-bill-discount-label">
                    <span>Adjustment / Discount</span>
                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={discount || ''}
                      placeholder="0.00"
                      disabled={isFinalized || busy}
                      onChange={e => setDiscount(Math.max(0, parseFloat(e.target.value) || 0))}
                    />
                  </div>
                  <span>-{formatCurrency(discount, currency)}</span>
                </div>

                <div className="pr-bill-divider" />

                <div className="pr-bill-grand-total-row">
                  <div>
                    <strong>TOTAL DUE</strong>
                    <small>All taxes & fees included</small>
                  </div>
                  <span className="pr-bill-grand-sum">{formatCurrency(grandTotal, currency)}</span>
                </div>

                {base && (
                  <div className="pr-bill-payment-recap">
                    <div className="pr-bill-recap-row">
                      <span>Amount Received</span>
                      <span className="pr-bill-paid-val">{formatCurrency(paidAmount, currency)}</span>
                    </div>
                    <div className="pr-bill-recap-row balance">
                      <span>Remaining Balance</span>
                      <strong className={outstandingBalance > 0 ? 'pr-bill-alert-val' : 'pr-bill-settled-val'}>
                        {formatCurrency(outstandingBalance, currency)}
                      </strong>
                    </div>
                  </div>
                )}

                <div className="pr-bill-totals-actions">
                  {!isFinalized && (!base || base.status === 'Draft') && (
                    <button
                      className="pr-button primary pr-bill-full-btn"
                      disabled={busy || items.length === 0 || !patientId}
                      onClick={() => void persist('Issued')}
                    >
                      <CheckCircle2 size={16} />
                      <span>Issue Official Invoice</span>
                    </button>
                  )}

                  {base && ['Issued', 'Part-paid'].includes(base.status) && (
                    <button
                      className="pr-button primary pr-bill-pay-action-btn"
                      onClick={() => {
                        setPayAmount(outstandingBalance.toFixed(2));
                        setPayDialogOpen(true);
                      }}
                    >
                      <CreditCard size={16} />
                      <span>Record Payment Receipt</span>
                    </button>
                  )}

                  <button
                    className="pr-button pr-bill-preview-toggle-btn"
                    onClick={() => setActiveTab('preview')}
                  >
                    <Receipt size={15} />
                    <span>View Formal Invoice Paper</span>
                  </button>
                </div>
              </div>

              {/* Handoff Actions */}
              {onRelated && (
                <div className="pr-bill-handoff-card">
                  <h4>Next Operational Steps</h4>
                  <p>Seamlessly coordinate next visits</p>
                  <div className="pr-bill-handoff-buttons">
                    <button
                      className="pr-bill-handoff-btn"
                      onClick={() => base && onRelated(base, 'appointments')}
                      disabled={!base}
                    >
                      <span>Book Next Clinical Visit</span>
                      <ArrowRight size={14} />
                    </button>
                    <button
                      className="pr-bill-handoff-btn"
                      onClick={() => base && onRelated(base, 'prescriptions')}
                      disabled={!base}
                    >
                      <span>Create New Prescription</span>
                      <ArrowRight size={14} />
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : (
          /* Formal Printable Invoice Preview */
          <div className="pr-bill-full-preview-container">
            <div className="pr-bill-paper-document">
              <div className="pr-bill-paper-top">
                <div className="pr-bill-paper-brand">
                  <HeartPulse className="pr-bill-paper-logo" size={34} />
                  <div>
                    <h2>MEDORA CLINICAL PRACTICE</h2>
                    <p>{currentBranch?.title || 'Main Branch'} · London Healthcare Operations</p>
                    <small>Registration Ref: MED-LON-2026 · VAT/Tax ID: GB928374910</small>
                  </div>
                </div>

                <div className="pr-bill-paper-inv-badge">
                  <span className={`pr-bill-doc-tag ${base?.status === 'Paid' ? 'paid' : base?.status === 'Issued' ? 'issued' : 'draft'}`}>
                    {base?.status === 'Paid' ? 'PAID RECEIPT' : base?.status === 'Part-paid' ? 'PARTIAL PAYMENT' : base?.status === 'Issued' ? 'TAX INVOICE' : 'DRAFT ESTIMATE'}
                  </span>
                  <strong>INV-{base ? base.id.slice(0, 8).toUpperCase() : 'NEW'}</strong>
                  <small>Date: {new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</small>
                </div>
              </div>

              <div className="pr-bill-paper-divider" />

              <div className="pr-bill-paper-client-grid">
                <div>
                  <label>INVOICE TO (PATIENT):</label>
                  <strong>{patientName}</strong>
                  <span>ID: {patient ? patient.id.slice(0, 8) : '—'}</span>
                  <span>{patient?.data.email || 'Email not recorded'}</span>
                  <span>{patient?.data.phone || 'Phone not recorded'}</span>
                </div>
                <div>
                  <label>INVOICE DETAILS:</label>
                  <span>Invoice Title: <strong>{title}</strong></span>
                  <span>Issue Date: {new Date().toLocaleDateString('en-GB')}</span>
                  <span>Due Date: <strong>{dueDate}</strong></span>
                  <span>Currency: {currency}</span>
                </div>
              </div>

              <table className="pr-bill-paper-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Service & Item Description</th>
                    <th>Category</th>
                    <th className="num-col">Qty</th>
                    <th className="num-col">Rate</th>
                    <th className="num-col">Amount ({currency})</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, idx) => (
                    <tr key={item.id}>
                      <td>{idx + 1}</td>
                      <td><strong>{item.description}</strong></td>
                      <td>{item.category}</td>
                      <td className="num-col">{item.quantity}</td>
                      <td className="num-col">{item.rate.toFixed(2)}</td>
                      <td className="num-col"><strong>{item.total.toFixed(2)}</strong></td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="pr-bill-paper-calculations">
                <div className="pr-bill-paper-terms">
                  <h4>Terms & Payment Instructions:</h4>
                  <p>{userNote}</p>
                  <small>Payment methods accepted: Electronic Bank Transfer, Card, Cash, and Direct Insurance Claim.</small>
                </div>

                <div className="pr-bill-paper-sums">
                  <div className="pr-bill-paper-sum-row">
                    <span>Subtotal</span>
                    <span>{formatCurrency(subtotal, currency)}</span>
                  </div>
                  {taxRate > 0 && (
                    <div className="pr-bill-paper-sum-row">
                      <span>Tax / VAT ({(taxRate * 100).toFixed(0)}%)</span>
                      <span>{formatCurrency(taxAmount, currency)}</span>
                    </div>
                  )}
                  {discount > 0 && (
                    <div className="pr-bill-paper-sum-row">
                      <span>Discount</span>
                      <span>-{formatCurrency(discount, currency)}</span>
                    </div>
                  )}
                  <div className="pr-bill-paper-sum-row total">
                    <strong>TOTAL DUE</strong>
                    <strong>{formatCurrency(grandTotal, currency)}</strong>
                  </div>
                  <div className="pr-bill-paper-sum-row paid">
                    <span>Amount Paid</span>
                    <span>{formatCurrency(paidAmount, currency)}</span>
                  </div>
                  <div className="pr-bill-paper-sum-row balance">
                    <strong>Balance Outstanding</strong>
                    <strong className={outstandingBalance > 0 ? 'alert' : 'settled'}>
                      {formatCurrency(outstandingBalance, currency)}
                    </strong>
                  </div>
                </div>
              </div>

              <div className="pr-bill-paper-footer">
                <div>
                  <small>This official document was generated electronically through Medora Practice OS.</small>
                  <small>Attributed Server Record Version {base?.version || 1} · Verified Idempotency Token</small>
                </div>
                <div className="pr-bill-finance-stamp">
                  <ShieldCheck size={28} />
                  <span>MEDORA FINANCE AUTHORIZED</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Record Payment Dialog */}
      <Dialog open={payDialogOpen} onOpenChange={setPayDialogOpen}>
        <DialogContent className="pr-dialog pr-bill-pay-dialog">
          <DialogHeader>
            <DialogTitle>Record Patient Payment</DialogTitle>
            <DialogDescription>
              Record an already collected patient payment against this invoice. Outstanding balance: {formatCurrency(outstandingBalance, currency)}.
            </DialogDescription>
          </DialogHeader>

          <div className="pr-bill-pay-form">
            <div className="pr-bill-pay-balance-banner">
              <span>Outstanding Invoice Amount</span>
              <strong>{formatCurrency(outstandingBalance, currency)}</strong>
            </div>

            <label className="wide">
              Payment Method
              <select value={payMethod} onChange={e => setPayMethod(e.target.value)}>
                <option value="Credit/Debit Card">Credit / Debit Card</option>
                <option value="Cash">Cash</option>
                <option value="Bank Wire / UPI">Bank Wire / UPI Transfer</option>
                <option value="Health Insurance">Health Insurance Reimbursement</option>
              </select>
            </label>

            <label className="wide">
              Amount Received ({currency})
              <input
                type="number"
                step="0.01"
                min="0.01"
                max={outstandingBalance}
                value={payAmount}
                onChange={e => setPayAmount(e.target.value)}
                placeholder="Enter amount collected"
              />
              <small>Must not exceed the outstanding balance.</small>
            </label>
          </div>

          <div className="pr-form-footer">
            <button className="pr-button" onClick={() => setPayDialogOpen(false)} disabled={busy}>
              Cancel
            </button>
            <button
              className="pr-button primary"
              disabled={busy || !payAmount || Number(payAmount) <= 0 || Number(payAmount) > outstandingBalance}
              onClick={() => void handleRecordPayment()}
            >
              <Check size={16} />
              <span>{busy ? 'Processing…' : 'Confirm & Save Receipt'}</span>
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
