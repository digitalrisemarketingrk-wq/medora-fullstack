'use client';
import type { ReactNode } from 'react';
import { Check, Sparkles, ShieldCheck } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';

export function FeatureBanner({ icon: Icon = Sparkles, label, title, children, action, tone = 'blue' }: { icon?: any; label: string; title: string; children: ReactNode; action?: ReactNode; tone?: string }) {
  return <section className={`feature-banner ${tone}`}><div className="feature-banner-icon"><Icon size={25}/></div><div><span className="feature-kicker">{label}</span><h2>{title}</h2><p>{children}</p></div>{action && <div className="feature-banner-action">{action}</div>}</section>;
}
export function FlowSteps({ items, active }: { items: string[]; active: number }) {
  return <ol className="flow-steps" aria-label="Workflow progress">{items.map((label, i) => <li key={label} className={i < active ? 'complete' : i === active ? 'current' : ''} aria-current={i === active ? 'step' : undefined}><span>{i < active ? <Check size={14}/> : i + 1}</span><strong>{label}</strong></li>)}</ol>;
}
export function FeatureDialog({ open, onClose, title, description, children, wide = false }: { open: boolean; onClose: () => void; title: string; description: string; children: ReactNode; wide?: boolean }) {
  return <Dialog open={open} onOpenChange={v => !v && onClose()}><DialogContent className={`modal-box feature-dialog ${wide ? 'wide' : ''}`}><DialogHeader><DialogTitle>{title}</DialogTitle><DialogDescription>{description}</DialogDescription></DialogHeader>{children}</DialogContent></Dialog>;
}
export function DemoBoundary({ children }: { children: ReactNode }) {
  return <div className="demo-boundary"><ShieldCheck size={16}/><span>{children}</span></div>;
}
