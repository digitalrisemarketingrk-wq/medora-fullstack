'use client';

import {useState,lazy,Suspense} from 'react';
import {CalendarDays} from 'lucide-react';
import {Popover,PopoverContent,PopoverTrigger} from '@/components/ui/popover';

const Calendar=lazy(()=>import('@/components/ui/calendar').then(value=>({default:value.Calendar})));

export function PracticeDateTimeField({value,label,timezone,required,onChange}:{value:string;label:string;timezone?:string;required:boolean;onChange:(value:string)=>void}){
  const[open,setOpen]=useState(false);
  const[day='',time='']=value.split('T');
  const selected=/^\d{4}-\d{2}-\d{2}$/.test(day)?new Date(day+'T12:00:00'):undefined;
  return <span className="pr-datetime-field"><span><input type="text" aria-label={label+' date'} placeholder="YYYY-MM-DD" pattern="[0-9]{4}-[0-9]{2}-[0-9]{2}" required={required} value={day} maxLength={10} onChange={e=>onChange(e.target.value+'T'+time)}/><Popover open={open} onOpenChange={setOpen}><PopoverTrigger asChild><button type="button" className="pr-date-trigger" aria-label={'Choose '+label.toLowerCase()+' date'}><CalendarDays size={17}/></button></PopoverTrigger><PopoverContent className="w-auto p-0" align="start"><Suspense fallback={<div role="status" className="p-5">Loading calendar…</div>}><Calendar mode="single" selected={selected&&Number.isFinite(selected.getTime())?selected:undefined} defaultMonth={selected&&Number.isFinite(selected.getTime())?selected:undefined} onSelect={date=>{if(!date)return;const next=`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;onChange(next+'T'+time);setOpen(false);}}/></Suspense></PopoverContent></Popover></span><input type="text" aria-label={label+' time'} placeholder="HH:MM" required={required} maxLength={5} pattern="([01][0-9]|2[0-3]):[0-5][0-9]" value={time} onChange={e=>onChange(day+'T'+e.target.value)}/><small>{timezone||'Clinic local time'} · 24-hour format</small></span>;
}
