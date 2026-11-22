import asyncio, httpx, uuid, json
from datetime import date, timedelta
from medora.config import Settings
from medora.store import Store

def offset(days):
    return (date.today() + timedelta(days=days)).isoformat()

sample_docs = [
    {
        'id': 'doc_xray_01',
        'name': 'Chest X-Ray (PA View).pdf',
        'type': 'Radiology',
        'date': offset(-21),
        'size': '340 KB',
        'summary': 'PA chest radiograph performed for evaluation of mild persistent seasonal cough. Lungs are clear bilaterally with no focal consolidation, pneumothorax, or pleural effusion. Cardiac silhouette is within normal limits (cardiothoracic ratio 0.44). Bony thorax and soft tissues unremarkable. Conclusion: Normal chest radiograph with no active cardiopulmonary disease.',
        'findings': [
            'Lungs: Clear bilaterally, no focal infiltrates, consolidation, or nodules',
            'Pleura: Costophrenic sulci sharp, no pleural effusion or thickening',
            'Heart: Normal cardiothoracic ratio (0.44) and contour',
            'Osseous structures: Intact thoracic cage, unremarkable soft tissues',
            'Impression: Normal radiograph, no active cardiopulmonary pathology'
        ],
        'glossary': [
            {'term': 'PA View (Posteroanterior)', 'meaning': 'Standard chest X-ray taken with the X-ray beam travelling from back to front.'},
            {'term': 'Pleural effusion', 'meaning': 'Abnormal fluid accumulation between the membranes lining the lungs.'},
            {'term': 'Cardiothoracic ratio (CTR)', 'meaning': 'Ratio of transverse cardiac diameter to thoracic width; values under 0.50 are normal.'},
            {'term': 'Consolidation', 'meaning': 'Solidification of lung tissue caused by fluid or inflammatory exudate instead of air.'}
        ],
        'analysisStatus': 'analysed',
        'indexed': True,
        'extractedText': 'PATIENT: Alex Morgan | PROCEDURE: PA Chest Radiograph | DATE: ' + offset(-21) + ' | INDICATION: Evaluation of mild persistent cough. Non-smoker. | TECHNIQUE: Single PA upright chest view. | FINDINGS: Trachea is midline. Lungs are well-expanded and clear bilaterally. No evidence of focal airspace consolidation, interstitial opacities, or masses. Pleural spaces are clear with sharp costophrenic angles. Cardiac silhouette is normal in size and configuration (CTR 0.44). Mediastinal contours normal. Visualized osseous structures intact. | IMPRESSION: Normal chest radiograph with no acute cardiopulmonary pathology.'
    },
    {
        'id': 'doc_blood_02',
        'name': 'Blood Test Report - CMP & Lipid Panel.pdf',
        'type': 'Lab report',
        'date': offset(-7),
        'size': '215 KB',
        'summary': 'Comprehensive metabolic panel and complete blood count. Fasting blood glucose is 92 mg/dL (normal: 70-99). Total cholesterol is 185 mg/dL with HDL 58 mg/dL and LDL 108 mg/dL. Hemoglobin is 14.2 g/dL. Kidney markers (Creatinine 0.9 mg/dL, eGFR > 90) and liver enzymes (ALT 22 U/L, AST 19 U/L) are fully within optimal reference intervals. Trace vitamin D insufficiency noted.',
        'findings': [
            'Fasting Blood Glucose: 92 mg/dL (Normal: 70–99 mg/dL)',
            'Lipid Panel: Total Cholesterol 185 mg/dL, HDL 58 mg/dL, LDL 108 mg/dL',
            'Kidney Function: Creatinine 0.9 mg/dL, eGFR > 90 mL/min/1.73m² (Optimal)',
            'Complete Blood Count: Hemoglobin 14.2 g/dL, Platelets 240,000/μL (Normal)',
            'Vitamin D (25-OH): 28 ng/mL (Mild insufficiency, target > 30 ng/mL)'
        ],
        'glossary': [
            {'term': 'eGFR', 'meaning': 'Estimated Glomerular Filtration Rate; evaluates how effectively the kidneys filter waste.'},
            {'term': 'HDL & LDL', 'meaning': 'High-density (good) and Low-density (bad) lipoproteins carrying cholesterol in blood.'},
            {'term': 'CMP', 'meaning': 'Comprehensive Metabolic Panel; blood test measuring electrolytes, glucose, kidney and liver enzymes.'}
        ],
        'analysisStatus': 'analysed',
        'indexed': True,
        'extractedText': 'PATIENT: Alex Morgan | TEST: Comprehensive Metabolic Panel & Lipid Profile | Fasting Glucose: 92 mg/dL | Total Cholesterol: 185 mg/dL | HDL: 58 mg/dL | LDL: 108 mg/dL | Triglycerides: 95 mg/dL | Creatinine: 0.9 mg/dL | eGFR: >90 | AST: 19 U/L | ALT: 22 U/L | Hemoglobin: 14.2 g/dL | Platelets: 240 K/uL | 25-OH Vitamin D: 28 ng/mL (Reference: >30 ng/mL).'
    },
    {
        'id': 'doc_consult_03',
        'name': 'Annual Health Review Summary.pdf',
        'type': 'Consultation',
        'date': offset(-14),
        'size': '180 KB',
        'summary': 'Annual comprehensive consultation with Dr. Rajesh Sharma. Blood pressure measured at 118/76 mmHg. Resting pulse 68 bpm. BMI 22.4. Discussed lifestyle optimization, routine physical activity, and continued Vitamin D supplementation (1000 IU daily). Next annual review scheduled in 12 months.',
        'findings': [
            'Blood Pressure: 118/76 mmHg (Normotensive)',
            'Resting Pulse: 68 bpm (Regular rate and rhythm)',
            'BMI: 22.4 kg/m² (Healthy weight range)',
            'Plan: Maintain daily 1000 IU Vitamin D supplement and regular physical activity'
        ],
        'glossary': [
            {'term': 'Normotensive', 'meaning': 'Having normal blood pressure within standard clinical guidelines (less than 120/80 mmHg).'},
            {'term': 'BMI (Body Mass Index)', 'meaning': 'Calculation of body mass based on height and weight.'}
        ],
        'analysisStatus': 'analysed',
        'indexed': True,
        'extractedText': 'CLINIC: Apollo City Clinic | CLINICIAN: Dr. Rajesh Sharma | PATIENT: Rahul Sharma | REASON: Annual routine preventive health review | VITALS: BP 118/76 mmHg, HR 68 bpm, SpO2 99%, BMI 22.4 kg/m2 | SUMMARY: Patient in good overall health. Dietary habits and aerobic fitness discussed. Continue Vitamin D3 1000 IU daily.'
    },
    {
        'id': 'doc_referral_04',
        'name': 'Cardiology Specialist Referral.pdf',
        'type': 'Referral',
        'date': offset(-3),
        'size': '165 KB',
        'summary': 'Elective referral to Dr. Amit Patel (Cardiology) at Apollo City Clinic for routine athletic cardiovascular screening prior to half-marathon participation. Baseline resting ECG unremarkable.',
        'findings': [
            'Referring Clinician: Dr. Rajesh Sharma (Apollo City Clinic)',
            'Recipient: Dr. Amit Patel (Apollo City Clinic)',
            'Indication: Routine pre-sports cardiovascular checkup',
            'ECG: Normal sinus rhythm, normal axis, no ST-T abnormalities'
        ],
        'glossary': [
            {'term': 'Sinus rhythm', 'meaning': 'Normal electrical rhythm of the heart initiated by the sinoatrial node.'},
            {'term': 'Referral', 'meaning': 'Formal recommendation from a primary care doctor to consult a specialist.'}
        ],
        'analysisStatus': 'analysed',
        'indexed': True,
        'extractedText': 'REFERRAL: Dr. Rajesh Sharma to Dr. Amit Patel | Apollo City Clinic Cardiology Service | PATIENT: Rahul Sharma | NOTES: Referring Rahul for routine sports cardiology screening ahead of half-marathon race. Resting ECG normal sinus rhythm. No cardiovascular symptoms.'
    }
]

async def main():
    s = Settings()
    async with httpx.AsyncClient() as client:
        store = Store(s, client)
        p = await store.profile_by_email('patient@medora.demo')
        ws = await store.workspace(p.id)
        data = ws['data']
        curr_docs = data.get('documents', [])
        curr_ids = {d['id'] for d in curr_docs}
        added = 0
        for doc in sample_docs:
            if doc['id'] not in curr_ids:
                curr_docs.append(doc)
                added += 1
        data['documents'] = curr_docs
        features = data.setdefault('features', {})
        dq = features.setdefault('documentQuestions', {})
        dq['doc_xray_01'] = [
            'Is there any sign of lung infection or fluid?',
            'What does a normal cardiothoracic ratio mean for my heart?',
            'Do I need any follow-up imaging if my cough has resolved?'
        ]
        dq['doc_blood_02'] = [
            'What is the recommended daily dosage for my mild vitamin D insufficiency?',
            'Are my cholesterol and glucose levels in the optimal range?',
            'When should I repeat my routine metabolic blood panel?'
        ]
        dq['doc_consult_03'] = [
            'Are my blood pressure and resting heart rate on target?',
            'What health goals should I focus on before my next annual review?'
        ]
        dq['doc_referral_04'] = [
            'What tests will Dr Daniel Brooks perform during the cardiology checkup?',
            'Do I need to prepare anything special before the consultation?'
        ]
        res = await store.save(p.id, data, ws['version'])
        print(f"SUCCESS: Seeded {added} documents into patient workspace. Total docs: {len(curr_docs)}")

if __name__ == '__main__':
    asyncio.run(main())
