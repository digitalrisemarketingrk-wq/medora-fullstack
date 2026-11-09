'use client';

import {useCallback, useEffect, useRef, useState} from 'react';
import type {DemoData} from './medora-demo';
import {api, ApiError, type Profile, type WorkspaceSnapshot} from './medora-api';

export function useRemoteWorkspace(ownerId?: string, enabled=true) {
  const [data, setData] = useState<DemoData | null>(null);
  const [user, setUser] = useState<Profile | null>(null);
  const [status, setStatus] = useState<'loading' | 'saving' | 'saved' | 'error'>('loading');
  const [error, setError] = useState('');
  const current = useRef<DemoData | null>(null);
  const baseline = useRef<WorkspaceSnapshot | null>(null);
  const dirty = useRef(0);
  const saved = useRef(0);
  const epoch = useRef(0);
  const activeOwner = useRef(ownerId);
  const pending = useRef<Promise<void> | null>(null);
  const mutation = useRef(false);
  const queued = useRef<((value:DemoData)=>DemoData)[]>([]);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const accept = useCallback((snapshot: WorkspaceSnapshot) => {
    snapshot = {...snapshot,can_write:snapshot.can_write??baseline.current?.can_write??true};
    baseline.current = snapshot; current.current = snapshot.data;
    dirty.current = 0; saved.current = 0; setData(snapshot.data); setError(''); setStatus('saved');
  }, []);

  const reload = useCallback(async () => {
    const generation = ++epoch.current;
    if (timer.current) clearTimeout(timer.current);
    activeOwner.current = ownerId; current.current = null; baseline.current = null; setData(null); setStatus('loading'); setError('');
    try {
      const {user: profile} = await api.me();
      const snapshot = await api.workspace(ownerId);
      if (epoch.current !== generation) return;
      setUser(profile); accept(snapshot);
    } catch (e) {
      if (epoch.current !== generation) return;
      if (e instanceof ApiError && e.status === 401) {window.location.replace('/login'); return;}
      setError(e instanceof Error ? e.message : 'Your workspace could not be loaded.'); setStatus('error');
    }
  }, [ownerId, accept]);

  useEffect(() => {if(enabled)void reload(); return () => {++epoch.current; if (timer.current) clearTimeout(timer.current);};}, [reload,enabled]);

  const flush = useCallback(async () => {
    if (pending.current) {await pending.current; return;}
    const startedEpoch = epoch.current;
    const run = async () => {
      while (dirty.current > saved.current && current.current && baseline.current && startedEpoch === epoch.current) {
        const target = dirty.current;
        const value = current.current;
        setStatus('saving'); setError('');
        try {
          const snapshot = await api.save(value, baseline.current.version, activeOwner.current);
          if (startedEpoch !== epoch.current) return;
          baseline.current = snapshot; saved.current = target;
          if (dirty.current === target) {current.current = snapshot.data; setData(snapshot.data);}
          setStatus('saved');
        } catch (e) {
          if (startedEpoch === epoch.current) {setError(e instanceof Error ? e.message : 'Your changes could not be saved.'); setStatus('error');}
          throw e;
        }
      }
    };
    pending.current = run().finally(() => {pending.current = null;});
    await pending.current;
  }, []);

  const update = useCallback((fn: (previous: DemoData) => DemoData) => {
    if (baseline.current?.can_write===false) {setError('You have view-only access to this record. Ask the patient for clinical editing access.');return;}
    if (mutation.current) {queued.current.push(fn); return;}
    if (!current.current) return;
    const next = fn(current.current);
    current.current = next; setData(next); dirty.current += 1; setStatus('saving');
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {void flush().catch(() => {});}, 400);
  }, [flush]);

  const mutate = useCallback(async <T extends {workspace:WorkspaceSnapshot}>(operation:()=>Promise<T>):Promise<T> => {
    if (baseline.current?.can_write===false) throw new Error('This care record has view-only access.');
    if (mutation.current) throw new Error('Another record operation is still in progress.');
    const generation=epoch.current;
    mutation.current=true;
    try {
      await flush();
      const result=await operation();
      if(generation===epoch.current) accept(result.workspace);
      return result;
    } finally {
      mutation.current=false;
      const changes=queued.current.splice(0);
      if(generation===epoch.current) for(const change of changes) update(change);
    }
  },[accept,flush,update]);

  useEffect(() => {
    const protectUnsaved = (e: BeforeUnloadEvent) => {if (dirty.current > saved.current) {e.preventDefault(); e.returnValue = '';}};
    window.addEventListener('beforeunload', protectUnsaved);
    return () => window.removeEventListener('beforeunload', protectUnsaved);
  }, []);

  const flushVisible=useCallback(async()=>{if(mutation.current)throw new Error('Wait for the current document operation to finish.');await flush();},[flush]);
  return {data, user, update, accept, flush:flushVisible, mutate, reload, error, status, reset: () => {throw new Error('Live records cannot be reset to demo data.');}};
}
