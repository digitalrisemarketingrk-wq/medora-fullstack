"""Validate persisted UI data before it can be read by another workspace session."""
from datetime import date
import re

ROW_FIELDS = {
    'patients': {'name':str,'age':int,'initials':str,'condition':str,'lastVisit':str,'email':str,'risk':str},
    'appointments': {'patientId':str,'patient':str,'doctor':str,'specialty':str,'provider':str,'date':str,'time':str,'mode':str,'status':str,'reason':str,'prep':list},
    'tasks': {'title':str,'detail':str,'done':bool,'date':str},
    'documents': {'name':str,'type':str,'date':str,'size':str,'summary':str},
    'medicines': {'name':str,'detail':str,'time':str,'taken':bool,'reminder':bool},
    'family': {'name':str,'relation':str,'age':str},
    'notes': {'patientId':str,'title':str,'body':str,'date':str},
    'messages': {'to':str,'body':str,'time':str,'kind':str},
    'access': {'name':str,'scope':str,'active':bool},
    'audit': {'title':str,'time':str},
    'waiting': {'name':str,'specialty':str,'days':int,'risk':str,'status':str},
    'programmes': {'title':str,'participants':int,'active':bool},
}


def fields(value, specification, label):
    if not isinstance(value,dict) or any(type(value.get(k)) is not t for k,t in specification.items()):
        raise ValueError(f'Invalid {label} fields')


def strings(value):
    return isinstance(value,list) and len(value)<=1000 and all(isinstance(s,str) and len(s)<=12000 for s in value)


def details(data):
    for collection,spec in ROW_FIELDS.items():
        for row in data[collection]:
            fields(row,spec,collection)
            if any(isinstance(v,str) and len(v)>80000 for v in row.values()):
                raise ValueError(f'{collection} text is too long')
            if 'date' in spec:
                date.fromisoformat(row['date'])
            if collection=='patients':
                date.fromisoformat(row['lastVisit'])
                if not 0<=row['age']<=130: raise ValueError('Invalid patient age')
            if collection in ['appointments','medicines']:
                if not re.fullmatch(r'(?:[01]\d|2[0-3]):[0-5]\d',row['time']): raise ValueError('Invalid time')
            if collection=='appointments' and not strings(row['prep']): raise ValueError('Invalid preparation checklist')
    features=data['features']
    feature_fields={'carePreferences':dict,'medicationPlans':dict,'familyCare':dict,'visitAgendas':dict,'savedSummaries':list,'documentQuestions':dict,'documentShares':list,'clinicalDrafts':dict}
    fields(features,feature_fields,'feature')
    if set(features)!=set(feature_fields): raise ValueError('Invalid feature collection')
    fields(features['carePreferences'],{'area':str,'funding':str,'language':str,'accessible':bool,'availability':str,'urgency':str,'savedProviders':list},'care preference')
    if not strings(features['savedSummaries']) or not strings(features['carePreferences']['savedProviders']): raise ValueError('Invalid saved items')
    if any(not isinstance(k,str) or not strings(v) for k,v in features['documentQuestions'].items()): raise ValueError('Invalid document questions')
    if any(not isinstance(v,dict) or any(not isinstance(text,str) for text in v.values()) for v in features['clinicalDrafts'].values()): raise ValueError('Invalid clinical draft')
    for plan in features['medicationPlans'].values():
        fields(plan,{'times':list,'stock':int,'refillDate':str,'reviewDate':str,'refillRequested':bool,'safetyReviewed':bool,'doses':dict},'medication plan')
        if not strings(plan['times']) or any(not strings(v) for v in plan['doses'].values()): raise ValueError('Invalid medication schedule')
    for family in features['familyCare'].values():
        fields(family,{'caregiver':str,'permission':str,'reminders':bool,'vaccinations':list,'medications':list},'family care')
        for v in family['vaccinations']: fields(v,{'id':str,'title':str,'date':str,'status':str},'vaccination')
        for m in family['medications']: fields(m,{'id':str,'name':str,'instructions':str,'time':str,'taken':bool},'family medication')
    for visit in features['visitAgendas'].values():
        fields(visit,{'questions':list,'documentIds':list,'reminder':bool,'notes':str,'preVisitForm':dict,'actions':list},'visit agenda')
        if not strings(visit['questions']) or not strings(visit['documentIds']): raise ValueError('Invalid visit questions')
        fields(visit['preVisitForm'],{'concerns':str,'accessNeeds':str,'completed':bool},'pre-visit form')
        for action in visit['actions']: fields(action,{'id':str,'title':str,'done':bool},'visit action')
    for share in features['documentShares']: fields(share,{'id':str,'documentId':str,'recipient':str,'permission':str,'expires':str},'sharing preview')
    fields(data['settings'],{**{k:str for k in ['name','location','blood','language']},**{k:bool for k in ['largeText','highContrast','readAloud','simple','notifications','treatment','sharing','research']}},'settings')
    if any(type(v) is not bool for v in data['team'].values()): raise ValueError('Invalid team state')
