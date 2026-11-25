import React, { useEffect, useState } from 'react';
import { Image, KeyboardAvoidingView, Platform, Pressable, SafeAreaView, ScrollView, StatusBar, StyleSheet, Text, TextInput, View, } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as SecureStore from 'expo-secure-store';
const tabs = [
    { id: 'Ask', icon: '⌕' }, { id: 'Procedures', icon: '☷' }, { id: 'Diagnose', icon: '⌁' },
    { id: 'Catalog', icon: '▦' }, { id: 'Account', icon: '◉' },
];
const ink = '#182b27', muted = '#71817a', green = '#176b52', paper = '#f4f5ef', white = '#ffffff', line = '#e1e6df';
const apiBase = (process.env.EXPO_PUBLIC_API_URL || '').replace(/\/+$/, '');
const DEMO_EQUIPMENT = [
    { id: 'demo-transformer', name: 'Power Transformer', description: 'Oil-filled power transformer', _count: { tests: 3 } },
    { id: 'demo-breaker', name: 'Circuit Breaker', description: 'High-voltage circuit breaker', _count: { tests: 2 } },
    { id: 'demo-ct', name: 'Instrument Transformer', description: 'CT / CVT / PT equipment', _count: { tests: 1 } },
    { id: 'demo-arrester', name: 'Surge Arrester', description: 'Station class surge arrester', _count: { tests: 1 } },
];
const DEMO_TESTS = [
    { id: 'demo-ir', name: 'Insulation Resistance & Polarisation Index', equipmentId: 'demo-transformer', equipment: { name: 'Power Transformer' }, tools: ['Insulation resistance tester', 'Temperature probe'], steps: ['Confirm the approved work permit, isolation, earthing and discharge requirements.', 'Inspect bushings, terminals and test leads before connecting instruments.', 'Perform the approved insulation resistance measurements for the winding configuration.', 'Record readings with ambient and oil temperature, instrument details and test duration.', 'Discharge and earth the tested winding as directed by the approved procedure.'], limits: 'Use the applicable OEM and utility acceptance criteria for this asset and test voltage.', safety: ['Follow permit-to-work and lockout/tagout requirements.', 'Verify dead, apply earths and discharge windings after testing.'], standard: 'Use current utility procedure and applicable IEC / IEEE guidance.', troubleshooting: 'Compare against the asset baseline and investigate trends with a qualified engineer.' },
    { id: 'demo-winding', name: 'Winding Resistance', equipmentId: 'demo-transformer', equipment: { name: 'Power Transformer' }, tools: ['Winding resistance meter', 'Temperature probe'], steps: ['Verify the transformer is isolated and safely earthed.', 'Connect the instrument using the approved winding configuration.', 'Wait for readings to stabilise and record winding and oil temperature.', 'Repeat for required phases and tap positions, then safely discharge the winding.'], limits: 'Compare phase and historical values using the manufacturer and utility criteria.', safety: ['High inductance circuits can retain energy; follow the instrument discharge sequence.'], standard: 'Refer to the approved site procedure and OEM documentation.' },
    { id: 'demo-dga', name: 'Dissolved Gas Analysis (DGA)', equipmentId: 'demo-transformer', equipment: { name: 'Power Transformer' }, tools: ['Oil sampling kit', 'Gas chromatograph (laboratory)'], steps: ['Collect a representative oil sample using the approved clean sampling method.', 'Label the sample with asset ID, location, date and sampling conditions.', 'Send the sealed sample to an approved laboratory for gas analysis.', 'Review results against prior samples, asset history and the applicable guidance.'], limits: 'Interpret concentrations and trends using the applicable standard and asset-specific guidance.', safety: ['Use the approved oil handling, PPE and environmental disposal procedures.'], standard: 'IEC 60599 / IEEE C57.104 (verify current applicable edition).' },
    { id: 'demo-contact', name: 'Contact Resistance', equipmentId: 'demo-breaker', equipment: { name: 'Circuit Breaker' }, tools: ['Micro-ohmmeter', 'Test leads'], steps: ['Confirm the breaker is isolated and earthed under the approved permit.', 'Prepare contact surfaces and connect the instrument per its manufacturer instructions.', 'Measure each pole using the approved test current and record ambient conditions.', 'Compare poles and historical results, then restore the equipment to the approved state.'], limits: 'Use manufacturer and utility acceptance criteria; trend phase-to-phase and against baseline.', safety: ['Verify isolation and apply earths before connecting test equipment.'], standard: 'Follow OEM maintenance instructions and the approved utility procedure.' },
    { id: 'demo-timing', name: 'Circuit Breaker Timing', equipmentId: 'demo-breaker', equipment: { name: 'Circuit Breaker' }, tools: ['Breaker analyser', 'Timing transducers'], steps: ['Isolate the breaker and confirm stored-energy mechanisms are controlled.', 'Install analyser leads and transducers according to the equipment manual.', 'Run the approved operation sequence and capture timing traces.', 'Review pole synchronism and compare with manufacturer tolerances.'], limits: 'Interpret against the breaker manufacturer specifications and site acceptance criteria.', safety: ['Control spring, hydraulic or pneumatic stored energy before work.'], standard: 'Refer to OEM documentation and the current approved maintenance procedure.' },
    { id: 'demo-ratio', name: 'Ratio & Polarity Test', equipmentId: 'demo-ct', equipment: { name: 'Instrument Transformer' }, tools: ['Transformer turns ratio tester', 'Approved test leads'], steps: ['Identify the nameplate ratio and terminal markings.', 'Isolate and earth the equipment using the approved procedure.', 'Connect the test instrument according to its manual and the nameplate.', 'Record ratio and polarity results and compare with approved criteria.'], limits: 'Compare with the nameplate and applicable manufacturer / utility tolerances.', safety: ['Never leave a current transformer secondary open while primary current can flow.'], standard: 'Refer to the equipment nameplate and current utility procedure.' },
    { id: 'demo-leakage', name: 'Leakage Current & Counter Check', equipmentId: 'demo-arrester', equipment: { name: 'Surge Arrester' }, tools: ['Leakage current monitor', 'Thermal camera'], steps: ['Inspect the arrester and counter for visible damage from a safe position.', 'Record counter value and environmental conditions.', 'Measure leakage current only with approved equipment and site procedure.', 'Compare phase trends and history; report abnormal observations.'], limits: 'Use manufacturer limits and compare against historical phase trends.', safety: ['Maintain required approach distances and follow high-voltage work controls.'], standard: 'Refer to OEM instructions and current utility standards.' },
];
async function backend(path, token, body) {
    if (!apiBase)
        throw new Error('Set EXPO_PUBLIC_API_URL to your backend address.');
    let response;
    try {
        response = await fetch(`${apiBase}${path}`, {
            method: body === undefined ? 'GET' : 'POST',
            headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
            ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        });
    }
    catch {
        throw new Error('Could not reach the backend. Check its address and network connection.');
    }
    const data = await response.json().catch(() => ({}));
    if (!response.ok)
        throw new Error(data.error || data.message || `Backend request failed (${response.status}).`);
    return data;
}
export default function App() {
    const [screen, setScreen] = useState('Ask');
    const [user, setUser] = useState({ id: 'demo-user', name: 'Demo Engineer', email: 'demo@substationiq.app', role: 'DEMO' });
    const [token, setToken] = useState(null);
    const [equipmentItems, setEquipmentItems] = useState(DEMO_EQUIPMENT);
    const [testItems, setTestItems] = useState(DEMO_TESTS);
    const [selectedTest, setSelectedTest] = useState(null);
    const [photo, setPhoto] = useState(null);
    const [cameraPermission, requestCameraPermission] = useCameraPermissions();
    const [cameraRef, setCameraRef] = useState(null);
    const [cameraFacing, setCameraFacing] = useState('back');
    const [cameraError, setCameraError] = useState('');
    const [apiState, setApiState] = useState('checking');
    const [question, setQuestion] = useState('');
    const [equipment, setEquipment] = useState('Power transformer');
    const [symptoms, setSymptoms] = useState('');
    const [readings, setReadings] = useState('');
    const [busy, setBusy] = useState(false);
    const [submitted, setSubmitted] = useState(false);
    const [resultSearch, setResultSearch] = useState('');
    const [toast, setToast] = useState('');
    useEffect(() => {
        let active = true;
        (async () => {
            if (!apiBase) {
                if (active)
                    setApiState('offline');
                return;
            }
            try {
                const health = await fetch(`${apiBase}/api/health`);
                if (active)
                    setApiState(health.ok ? 'online' : 'offline');
            }
            catch {
                if (active)
                    setApiState('offline');
            }
            const savedToken = await SecureStore.getItemAsync('substationiq_token');
            if (savedToken) {
                try {
                    const result = await backend('/api/auth/me', savedToken);
                    if (active) {
                        setToken(savedToken);
                        setUser(result.user);
                    }
                }
                catch {
                    await SecureStore.deleteItemAsync('substationiq_token');
                }
            }
        })();
        return () => { active = false; };
    }, []);
    useEffect(() => {
        if (!token)
            return;
        backend('/api/equipment', token)
            .then(result => setEquipmentItems(result.equipment))
            .catch(error => { setEquipmentItems(DEMO_EQUIPMENT); notify(`Showing demo catalog: ${error.message}`); });
    }, [token]);
    const signOut = async () => {
        await SecureStore.deleteItemAsync('substationiq_token');
        setToken(null);
        setUser({ id: 'demo-user', name: 'Demo Engineer', email: 'demo@substationiq.app', role: 'DEMO' });
        setEquipmentItems(DEMO_EQUIPMENT);
        setTestItems(DEMO_TESTS);
        setScreen('Ask');
        notify('Demo portal ready.');
    };
    const loadEquipmentTests = async (item) => {
        setEquipment(item.name);
        if (!token || item.id.startsWith('demo-')) {
            setTestItems(DEMO_TESTS.filter(test => test.equipmentId === item.id));
            setSelectedTest(null);
            setScreen('Procedures');
            return;
        }
        try {
            const result = await backend(`/api/equipment/${item.id}/tests`, token || undefined);
            setTestItems(result.tests);
            setScreen('Procedures');
            if (!result.tests.length)
                notify('No tests are configured for this equipment yet.');
        }
        catch (error) {
            notify(error.message);
        }
    };
    const loadTests = async (search = '') => {
        if (!token) {
            const words = search.toLowerCase().split(/\s+/).filter(word => word.length > 2);
            setTestItems(DEMO_TESTS.filter(test => !words.length || words.some(word => `${test.name} ${test.equipment?.name} ${test.steps.join(' ')}`.toLowerCase().includes(word))));
            return;
        }
        try {
            const query = search ? `?search=${encodeURIComponent(search)}` : '';
            const result = await backend(`/api/tests${query}`, token || undefined);
            setTestItems(result.tests);
        }
        catch (error) {
            notify(error.message);
        }
    };
    const findRelatedTests = async (search) => {
        if (!token) {
            const words = search.toLowerCase().split(/\s+/).filter(word => word.length > 2);
            const results = DEMO_TESTS.filter(test => words.some(word => `${test.name} ${test.equipment?.name} ${test.steps.join(' ')}`.toLowerCase().includes(word)));
            setTestItems(results);
            setSubmitted(true);
            if (!results.length)
                notify('No related demo references found. Try a test name or equipment type.');
            return;
        }
        setBusy(true);
        try {
            const result = await backend(`/api/tests?search=${encodeURIComponent(search)}`, token);
            setTestItems(result.tests);
            setSubmitted(true);
            if (!result.tests.length)
                notify('No related catalog tests found.');
        }
        catch (error) {
            notify(error.message);
        }
        finally {
            setBusy(false);
        }
    };
    const searchCatalogForQuestion = async () => {
        if (!question.trim()) {
            notify('Enter a question to search the test catalog.');
            return;
        }
        if (!token) {
            const words = question.toLowerCase().split(/\s+/).filter(word => word.length > 2);
            const results = DEMO_TESTS.filter(test => words.some(word => `${test.name} ${test.equipment?.name} ${test.steps.join(' ')}`.toLowerCase().includes(word)));
            setTestItems(results);
            if (results.length) {
                setSelectedTest(results[0]);
                setScreen('Procedures');
            }
            else
                notify('No matching demo reference. Try “insulation”, “winding”, “DGA”, or “contact resistance”.');
            return;
        }
        try {
            const result = await backend(`/api/tests?search=${encodeURIComponent(question.trim())}`, token || undefined);
            setTestItems(result.tests);
            if (result.tests.length) {
                setSelectedTest(result.tests[0]);
                setScreen('Procedures');
            }
            else
                notify('No matching test found in the connected catalog.');
        }
        catch (error) {
            notify(error.message);
        }
    };
    const openCamera = async () => {
        setCameraError('');
        if (!cameraPermission?.granted) {
            const result = await requestCameraPermission();
            if (!result.granted) {
                setCameraError('Camera access is needed to capture equipment photos. Enable it in Settings to continue.');
                setScreen('Camera');
                return;
            }
        }
        setScreen('Camera');
    };
    const capture = async () => {
        if (!cameraRef)
            return;
        try {
            const result = await cameraRef.takePictureAsync({ quality: 0.75, skipProcessing: true });
            if (result?.uri) {
                setPhoto(result.uri);
                setScreen('Diagnose');
            }
        }
        catch {
            setCameraError('Could not capture this photo. Please try again.');
        }
    };
    const notify = (message) => { setToast(message); setTimeout(() => setToast(''), 2600); };
    if (screen === 'Camera')
        return <SafeAreaView style={styles.cameraRoot}>
    {cameraPermission?.granted ? <CameraView ref={setCameraRef} style={StyleSheet.absoluteFill} facing={cameraFacing}/> : <View style={styles.cameraPermission}><Text style={styles.cameraPermissionTitle}>Camera access</Text><Text style={styles.body}>Allow camera access to photograph an asset or nameplate for your diagnosis notes.</Text>{!cameraError && <Button label="Allow camera" onPress={openCamera}/>}{cameraError ? <Text style={styles.error}>{cameraError}</Text> : null}</View>}
    <View style={styles.cameraTop}><Pressable style={styles.cameraClose} onPress={() => setScreen('Diagnose')}><Text style={styles.cameraCloseText}>×</Text></Pressable><Text style={styles.cameraHint}>CENTER EQUIPMENT IN FRAME</Text><Pressable style={styles.cameraClose} onPress={() => setCameraFacing(f => f === 'back' ? 'front' : 'back')}><Text style={styles.cameraCloseText}>↻</Text></Pressable></View>
    {cameraPermission?.granted && <View style={styles.cameraBottom}><Pressable style={styles.shutterOuter} onPress={capture}><View style={styles.shutterInner}/></Pressable><Text style={styles.cameraCaption}>Tap to capture photo</Text></View>}
  </SafeAreaView>;
    return <SafeAreaView style={styles.safe}>
    <StatusBar barStyle="dark-content" backgroundColor={paper}/>
    <View style={styles.topbar}><View style={styles.brandMark}><Text style={styles.brandMarkText}>S</Text></View><View style={{ flex: 1 }}><Text style={styles.brand}>SUBSTATIONIQ</Text><Text style={styles.brandSub}>FIELD ENGINEERING</Text></View><View style={styles.status}><View style={[styles.statusDot, { backgroundColor: token && apiState === 'online' ? '#368667' : '#d09a42' }]}/><Text style={styles.statusText}>{token && apiState === 'online' ? 'CONNECTED' : 'DEMO PORTAL'}</Text></View></View>
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {!token && <View style={styles.demoBanner}><Text style={styles.demoBannerText}>DEMO MODE · SAMPLE CONTENT FOR PRESENTATION</Text></View>}
        {screen === 'Ask' && <>
          <Eyebrow>SUBSTATIONIQ ENGINEERING ASSISTANT</Eyebrow><Text style={styles.title}>What are we{'\n'}working on?</Text><Text style={styles.body}>Ask about maintenance tests, limits, procedures and equipment.</Text>
          <Card><Label>EQUIPMENT</Label><View style={styles.pills}>{['All equipment', 'Transformer', 'Circuit breaker'].map((x, i) => <Chip key={x} label={x} active={equipment === (i === 0 ? 'All equipment' : i === 1 ? 'Power transformer' : 'Circuit breaker')} onPress={() => setEquipment(i === 0 ? 'All equipment' : i === 1 ? 'Power transformer' : 'Circuit breaker')}/>)}</View><TextInput value={question} onChangeText={setQuestion} placeholder="Search e.g. insulation resistance limits" placeholderTextColor="#91a099" multiline style={styles.textarea}/><Button label="Search test catalog  →" onPress={() => void searchCatalogForQuestion()}/><Text style={styles.helper}>{token ? 'Catalog search uses your connected backend.' : 'Try “insulation”, “winding”, “DGA”, or “contact resistance” in this demo portal.'} AI chat is not implemented in the current backend.</Text></Card>
          <SectionTitle>QUICK START</SectionTitle><View style={styles.quickGrid}>{[['▤', 'Test procedures'], ['⌁', 'Fault diagnosis'], ['◉', 'DGA analysis'], ['◫', 'Check a result']].map(([icon, label]) => <Pressable key={label} style={styles.quickCard} onPress={() => setScreen(label === 'Test procedures' ? 'Procedures' : label === 'Fault diagnosis' ? 'Diagnose' : label === 'DGA analysis' ? 'DGA' : 'Results')}><Text style={styles.quickIcon}>{icon}</Text><Text style={styles.quickLabel}>{label}</Text><Text style={styles.quickArrow}>↗</Text></Pressable>)}</View>
          <View style={styles.safety}><Text style={styles.safetyIcon}>✳</Text><View style={{ flex: 1 }}><Text style={styles.safetyTitle}>Safety comes first</Text><Text style={styles.safetyText}>Always follow approved procedures, permits and OEM instructions.</Text></View></View>
        </>}
        {screen === 'Diagnose' && <><Eyebrow>ENGINEER TOOLS · 01</Eyebrow><Text style={styles.title}>Fault diagnosis</Text><Text style={styles.body}>Describe symptoms to find related tests and safety guidance.</Text><Card><Label>EQUIPMENT CLASS</Label><View style={styles.pills}>{equipmentItems.map(item => <Chip key={item.id} label={item.name} active={equipment === item.name} onPress={() => setEquipment(item.name)}/>)}</View><Label>SYMPTOMS</Label><TextInput value={symptoms} onChangeText={setSymptoms} placeholder="Describe observed symptoms…" placeholderTextColor="#91a099" multiline style={[styles.textarea, { minHeight: 94 }]}/><Label>TEST READINGS · OPTIONAL</Label><TextInput value={readings} onChangeText={setReadings} placeholder="e.g. H₂ 145 ppm, tan delta 1.9%" placeholderTextColor="#91a099" multiline style={styles.textarea}/><Pressable style={styles.photoButton} onPress={openCamera}><Text style={styles.photoIcon}>◎</Text><View style={{ flex: 1 }}><Text style={styles.photoTitle}>{photo ? 'Retake equipment photo' : 'Take equipment photo'}</Text><Text style={styles.photoSub}>Photo stays on this device; no image API is available</Text></View><Text style={styles.photoArrow}>›</Text></Pressable>{photo && <View style={styles.photoPreview}><Image source={{ uri: photo }} style={styles.previewImage}/><View style={{ flex: 1 }}><Text style={styles.photoTitle}>Photo attached</Text><Text style={styles.photoSub}>Stored on this device</Text></View><Pressable onPress={() => setPhoto(null)}><Text style={styles.remove}>Remove</Text></Pressable></View>}<Button label={busy ? 'Searching catalog…' : 'Find related tests  →'} onPress={() => { if (!symptoms.trim()) {
        notify('Describe the symptoms first.');
        return;
    } void findRelatedTests(symptoms); }}/><Text style={styles.helper}>This demo finds related references; the backend has no ranked fault diagnosis endpoint.</Text></Card>{submitted && <Card><Label>RELATED CATALOG TESTS</Label>{testItems.length ? testItems.map(test => <Pressable key={test.id} onPress={() => { setSelectedTest(test); setScreen('Procedures'); }}><Text style={styles.listTitle}>{test.name} · {test.equipment?.name}</Text><Text style={styles.listMeta}>{test.limits || 'Open to review procedure and safety guidance'}</Text></Pressable>) : <Text style={styles.body}>No matching records.</Text>}</Card>}<Text style={styles.disclaimer}>Diagnosis is an aid. Confirm findings with a qualified engineer and approved procedures.</Text></>}
        {screen === 'Procedures' && <><Eyebrow>FIELD REFERENCE · 02</Eyebrow><Text style={styles.title}>{selectedTest?.name || 'Test procedures'}</Text><Text style={styles.body}>{selectedTest ? selectedTest.equipment?.name || equipment : 'Test procedures returned by your connected equipment catalog.'}</Text>{selectedTest ? <Card>{selectedTest.tools?.length ? <><Label>TEST EQUIPMENT</Label><Text style={styles.detailText}>{selectedTest.tools.join(' · ')}</Text></> : null}<Label>PROCEDURE</Label>{(selectedTest.steps || []).map((step, i) => <View key={i} style={styles.stepRow}><Text style={styles.stepNo}>{String(i + 1).padStart(2, '0')}</Text><Text style={styles.detailText}>{step}</Text></View>)}{selectedTest.limits ? <><Label>ACCEPTABLE LIMITS</Label><Text style={styles.detailText}>{selectedTest.limits}</Text></> : null}{selectedTest.standard ? <><Label>STANDARD</Label><Text style={styles.detailText}>{selectedTest.standard}</Text></> : null}{selectedTest.safety?.length ? <><Label>SAFETY</Label>{selectedTest.safety.map((s, i) => <Text key={i} style={styles.detailText}>• {s}</Text>)}</> : null}{selectedTest.troubleshooting ? <><Label>TROUBLESHOOTING</Label><Text style={styles.detailText}>{selectedTest.troubleshooting}</Text></> : null}<Pressable onPress={() => setSelectedTest(null)}><Text style={styles.emptyAction}>← Back to results</Text></Pressable></Card> : <>{testItems.length ? testItems.map((test, i) => <Pressable key={test.id} style={styles.listCard} onPress={() => setSelectedTest(test)}><Text style={styles.listNumber}>{String(i + 1).padStart(2, '0')}</Text><View style={{ flex: 1 }}><Text style={styles.listTitle}>{test.name}</Text><Text style={styles.listMeta}>{test.equipment?.name || equipment}</Text></View><Text style={styles.chevron}>›</Text></Pressable>) : <Empty icon="▤" title="No tests loaded" text="Choose equipment from the catalog to load its live tests." action="Browse equipment" onPress={() => setScreen('Catalog')}/>}</>}<SafetyNote /></>}
        {screen === 'DGA' && <><Eyebrow>ENGINEER TOOLS · 02</Eyebrow><Text style={styles.title}>DGA analysis</Text><Text style={styles.body}>Look up dissolved gas analysis procedures in the connected test catalog.</Text><Card><Label>CATALOG SEARCH</Label><TextInput value={resultSearch} onChangeText={setResultSearch} placeholder="DGA, dissolved gas, oil sample…" placeholderTextColor="#91a099" style={styles.input}/><Button label="Search DGA references  →" onPress={() => void loadTests(resultSearch || 'DGA')}/><Text style={styles.helper}>This backend has no gas-ratio analyzer endpoint; readings cannot be interpreted here yet.</Text></Card>{testItems.map(test => <Pressable key={test.id} style={styles.listCard} onPress={() => { setSelectedTest(test); setScreen('Procedures'); }}><View style={{ flex: 1 }}><Text style={styles.listTitle}>{test.name}</Text><Text style={styles.listMeta}>{test.equipment?.name} · {test.limits || 'Open reference'}</Text></View><Text style={styles.chevron}>›</Text></Pressable>)}<SafetyNote /></>}
        {screen === 'Learn' && <><Eyebrow>KNOWLEDGE BASE · 03</Eyebrow><Text style={styles.title}>Learn</Text><Text style={styles.body}>Build confidence with practical substation maintenance guides.</Text>{[['01', 'Transformer fundamentals', 'Equipment guide · 8 min'], ['02', 'Understanding dissolved gases', 'Diagnostic guide · 6 min'], ['03', 'Electrical safety essentials', 'Safety guide · 5 min'], ['04', 'Circuit breaker maintenance', 'Equipment guide · 10 min']].map(([n, t, meta]) => <Pressable key={n} style={styles.listCard} onPress={() => notify(`${t} opened`)}><Text style={styles.listNumber}>{n}</Text><View style={{ flex: 1 }}><Text style={styles.listTitle}>{t}</Text><Text style={styles.listMeta}>{meta}</Text></View><Text style={styles.chevron}>›</Text></Pressable>)}</>}
        {screen === 'History' && <><Eyebrow>YOUR WORKSPACE · 04</Eyebrow><Text style={styles.title}>Recent activity</Text><Text style={styles.body}>Your questions, procedures and diagnoses in one place.</Text><Empty icon="◷" title="Nothing here yet" text="Your recent questions and field work will appear here." action="Ask a question" onPress={() => setScreen('Ask')}/></>}
        {screen === 'Catalog' && <><Eyebrow>REFERENCE LIBRARY · 05</Eyebrow><Text style={styles.title}>Equipment catalog</Text><Text style={styles.body}>Live equipment records from your backend.</Text>{equipmentItems.length ? equipmentItems.map(item => <Pressable key={item.id} style={styles.catalogCard} onPress={() => void loadEquipmentTests(item)}><Text style={styles.catalogIcon}>⚡</Text><View style={{ flex: 1 }}><Text style={styles.listTitle}>{item.name}</Text><Text style={styles.listMeta}>{item._count?.tests ?? 0} tests{item.description ? ` · ${item.description}` : ''}</Text></View><Text style={styles.chevron}>›</Text></Pressable>) : <Empty icon="▦" title="No equipment found" text="The backend returned no equipment records." action="Reload catalog" onPress={() => { if (token)
        void backend('/api/equipment', token).then(r => setEquipmentItems(r.equipment)).catch(e => notify(e.message)); }}/>}</>}
        {screen === 'Results' && <><Eyebrow>FIELD TOOL · 06</Eyebrow><Text style={styles.title}>Result checker</Text><Text style={styles.body}>Look up the acceptable limits stored in your connected test catalog.</Text><Card><Label>SEARCH TESTS</Label><TextInput value={resultSearch} onChangeText={setResultSearch} placeholder="e.g. insulation resistance" placeholderTextColor="#91a099" style={styles.input}/><Button label="Find catalog limits  →" onPress={() => void loadTests(resultSearch)}/><Text style={styles.helper}>The backend does not provide an automatic measured-value comparison endpoint.</Text></Card>{testItems.map(test => <Pressable key={test.id} style={styles.listCard} onPress={() => { setSelectedTest(test); setScreen('Procedures'); }}><View style={{ flex: 1 }}><Text style={styles.listTitle}>{test.name}</Text><Text style={styles.listMeta}>{test.limits || 'No limit recorded for this test'}</Text></View><Text style={styles.chevron}>›</Text></Pressable>)}<SafetyNote /></>}
        {screen === 'Account' && <><Eyebrow>YOUR WORKSPACE</Eyebrow><Text style={styles.title}>Demo portal</Text><Card><Text style={styles.avatar}>{user?.name?.slice(0, 2).toUpperCase() || 'SI'}</Text><Text style={styles.cardTitle}>{user?.name}</Text><Text style={styles.body}>{user?.email}</Text><View style={styles.rule}/><Label>MODE</Label><Text style={styles.listMeta}>{token ? `Connected · ${user?.role}` : 'Presentation demo · sample catalog content'}</Text><View style={styles.rule}/><Label>BACKEND STATUS</Label><Text style={styles.listMeta}>{apiState === 'online' ? 'Reachable' : 'Unavailable; demo data is active'}</Text>{token ? <Button label="Switch to demo portal" onPress={() => void signOut()}/> : <Text style={styles.helper}>No sign-in is needed to show the mobile portal.</Text>}</Card><SafetyNote /></>}
      </ScrollView>
    </KeyboardAvoidingView>
    {toast ? <View style={styles.toast}><Text style={styles.toastText}>{toast}</Text></View> : null}
    <View style={styles.tabbar}>{tabs.map(t => <Pressable key={t.id} onPress={() => setScreen(t.id)} style={styles.tab}><Text style={[styles.tabIcon, screen === t.id && styles.tabSelected]}>{t.icon}</Text><Text style={[styles.tabLabel, screen === t.id && styles.tabSelected]}>{t.id}</Text></Pressable>)}</View>
  </SafeAreaView>;
}
function Eyebrow({ children }) { return <Text style={styles.eyebrow}>{children}</Text>; }
function SectionTitle({ children }) { return <Text style={styles.sectionTitle}>{children}</Text>; }
function Label({ children }) { return <Text style={styles.label}>{children}</Text>; }
function Card({ children }) { return <View style={styles.card}>{children}</View>; }
function Button({ label, onPress }) { return <Pressable onPress={onPress} style={({ pressed }) => [styles.button, pressed && { opacity: .85 }]}><Text style={styles.buttonText}>{label}</Text></Pressable>; }
function Chip({ label, active, onPress }) { return <Pressable onPress={onPress} style={[styles.chip, active && styles.chipActive]}><Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text></Pressable>; }
function SearchPlaceholder() { return <View style={styles.search}><Text style={{ color: muted, fontSize: 17 }}>⌕</Text><Text style={styles.searchText}>Search tests, equipment, topics…</Text></View>; }
function SafetyNote() { return <View style={styles.safety}><Text style={styles.safetyIcon}>✳</Text><View style={{ flex: 1 }}><Text style={styles.safetyTitle}>Safety reminder</Text><Text style={styles.safetyText}>Use current approved procedures, permits and OEM guidance for every task.</Text></View></View>; }
function Empty({ icon, title, text, action, onPress }) { return <View style={styles.empty}><Text style={styles.emptyIcon}>{icon}</Text><Text style={styles.cardTitle}>{title}</Text><Text style={[styles.body, { textAlign: 'center' }]}>{text}</Text><Pressable onPress={onPress}><Text style={styles.emptyAction}>{action}  →</Text></Pressable></View>; }
const styles = StyleSheet.create({
    safe: { flex: 1, backgroundColor: paper }, demoBanner: { paddingHorizontal: 11, paddingVertical: 8, backgroundColor: '#e8eee7', borderRadius: 8, marginBottom: 17 }, demoBannerText: { fontSize: 9, fontWeight: '800', letterSpacing: .8, color: green }, helper: { fontSize: 11, lineHeight: 16, color: muted, marginTop: 12 }, detailText: { fontSize: 13, lineHeight: 19, color: ink, marginBottom: 8 }, stepRow: { flexDirection: 'row', gap: 10, marginBottom: 10 }, stepNo: { fontSize: 11, fontWeight: '800', color: green, width: 22 }, topbar: { height: 62, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: line, gap: 10 }, brandMark: { width: 34, height: 34, backgroundColor: green, alignItems: 'center', justifyContent: 'center', borderRadius: 9 }, brandMarkText: { fontSize: 20, fontWeight: '700', color: white }, brand: { fontSize: 12, fontWeight: '800', letterSpacing: 1.2, color: ink }, brandSub: { fontSize: 9, letterSpacing: 1.5, color: muted, marginTop: 3 }, status: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderColor: line, paddingHorizontal: 9, paddingVertical: 6, borderRadius: 20 }, statusDot: { width: 6, height: 6, borderRadius: 5 }, statusText: { fontSize: 9, fontWeight: '700', letterSpacing: .7, color: muted }, content: { paddingHorizontal: 20, paddingTop: 24, paddingBottom: 38 }, eyebrow: { fontSize: 10, fontWeight: '800', letterSpacing: 1.5, color: green, marginBottom: 10 }, title: { fontSize: 34, lineHeight: 39, fontWeight: '700', letterSpacing: -1, color: ink, marginBottom: 9 }, body: { fontSize: 14, lineHeight: 21, color: muted, marginBottom: 20 }, card: { backgroundColor: white, borderWidth: 1, borderColor: line, borderRadius: 16, padding: 18, marginTop: 8, marginBottom: 20 }, label: { fontSize: 10, fontWeight: '800', letterSpacing: 1.1, color: muted, marginBottom: 10, marginTop: 7 }, pills: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginBottom: 12 }, chip: { borderWidth: 1, borderColor: line, paddingHorizontal: 11, paddingVertical: 8, borderRadius: 20, backgroundColor: white }, chipActive: { backgroundColor: '#e7f1ec', borderColor: '#b7d4c6' }, chipText: { fontSize: 11, color: muted, fontWeight: '600' }, chipTextActive: { color: green }, textarea: { borderWidth: 1, borderColor: line, borderRadius: 10, minHeight: 86, padding: 12, textAlignVertical: 'top', fontSize: 14, color: ink, marginBottom: 13, backgroundColor: '#fcfdfa' }, button: { minHeight: 48, backgroundColor: green, borderRadius: 10, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16, marginTop: 4 }, buttonText: { color: white, fontSize: 14, fontWeight: '700', letterSpacing: .2 }, sectionTitle: { fontSize: 10, fontWeight: '800', letterSpacing: 1.3, color: muted, marginTop: 7, marginBottom: 11 }, quickGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 9 }, quickCard: { width: '48%', minHeight: 100, backgroundColor: white, borderWidth: 1, borderColor: line, borderRadius: 14, padding: 13, justifyContent: 'space-between' }, quickIcon: { fontSize: 20, color: green }, quickLabel: { fontSize: 13, fontWeight: '700', color: ink }, quickArrow: { position: 'absolute', right: 12, top: 13, color: muted, fontSize: 15 }, safety: { flexDirection: 'row', gap: 11, padding: 14, backgroundColor: '#eaf1eb', borderRadius: 12, marginTop: 20, marginBottom: 10 }, safetyIcon: { color: green, fontSize: 17 }, safetyTitle: { fontSize: 12, fontWeight: '700', color: ink, marginBottom: 4 }, safetyText: { fontSize: 12, lineHeight: 17, color: muted }, listCard: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, backgroundColor: white, borderWidth: 1, borderColor: line, borderRadius: 12, marginBottom: 8 }, listNumber: { fontSize: 11, fontWeight: '800', color: green, width: 25 }, listTitle: { fontSize: 14, fontWeight: '700', color: ink }, listMeta: { fontSize: 11, color: muted, marginTop: 4 }, chevron: { fontSize: 23, color: muted, paddingLeft: 6 }, readingRow: { height: 51, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: line }, readingLabel: { fontSize: 13, color: ink }, readingInput: { width: 92, textAlign: 'right', fontSize: 13, color: ink, paddingVertical: 8 }, photoButton: { borderWidth: 1, borderColor: '#b7d4c6', borderStyle: 'dashed', backgroundColor: '#f4f8f4', borderRadius: 11, padding: 13, flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14 }, photoIcon: { fontSize: 23, color: green }, photoTitle: { fontSize: 13, fontWeight: '700', color: ink }, photoSub: { fontSize: 10, color: muted, marginTop: 3 }, photoArrow: { fontSize: 22, color: green }, photoPreview: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 15 }, previewImage: { width: 54, height: 54, borderRadius: 9, backgroundColor: line }, remove: { fontSize: 11, color: '#a14e43', fontWeight: '600' }, error: { color: '#a14e43', fontSize: 13, lineHeight: 19, marginTop: 14 }, search: { height: 47, borderWidth: 1, borderColor: line, backgroundColor: white, borderRadius: 10, marginVertical: 8, marginBottom: 18, paddingHorizontal: 13, flexDirection: 'row', alignItems: 'center', gap: 8 }, searchText: { fontSize: 13, color: '#91a099' }, catalogCard: { flexDirection: 'row', alignItems: 'center', gap: 13, padding: 14, backgroundColor: white, borderWidth: 1, borderColor: line, borderRadius: 13, marginBottom: 9 }, catalogIcon: { width: 37, height: 37, textAlign: 'center', textAlignVertical: 'center', borderRadius: 10, overflow: 'hidden', backgroundColor: '#edf3ee', fontSize: 18, color: green }, input: { height: 45, borderWidth: 1, borderColor: line, borderRadius: 9, paddingHorizontal: 12, fontSize: 14, color: ink, marginBottom: 14, backgroundColor: '#fcfdfa' }, disclaimer: { fontSize: 11, lineHeight: 17, color: muted, marginTop: 3 }, empty: { alignItems: 'center', paddingHorizontal: 22, paddingVertical: 50, backgroundColor: white, borderWidth: 1, borderColor: line, borderRadius: 15, marginTop: 14 }, emptyIcon: { fontSize: 34, color: '#9bb2a5', marginBottom: 12 }, cardTitle: { fontSize: 17, fontWeight: '700', color: ink, marginBottom: 5 }, emptyAction: { color: green, fontSize: 13, fontWeight: '700', marginTop: 6 }, avatar: { width: 50, height: 50, borderRadius: 25, backgroundColor: '#e7f1ec', textAlign: 'center', textAlignVertical: 'center', fontWeight: '800', fontSize: 16, color: green, overflow: 'hidden', marginBottom: 12 }, rule: { height: 1, backgroundColor: line, marginVertical: 16 }, toast: { position: 'absolute', bottom: 83, left: 20, right: 20, backgroundColor: ink, borderRadius: 10, padding: 13 }, toastText: { color: white, fontSize: 12, textAlign: 'center' }, tabbar: { height: 62, backgroundColor: white, borderTopWidth: 1, borderTopColor: line, flexDirection: 'row', justifyContent: 'space-around', paddingBottom: 4 }, tab: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 2 }, tabIcon: { fontSize: 18, color: muted }, tabLabel: { fontSize: 9, color: muted, fontWeight: '600' }, tabSelected: { color: green, fontWeight: '800' }, cameraRoot: { flex: 1, backgroundColor: '#111' }, cameraTop: { position: 'absolute', top: 25, left: 18, right: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, cameraClose: { width: 42, height: 42, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,.45)' }, cameraCloseText: { fontSize: 27, color: white, lineHeight: 30 }, cameraHint: { fontSize: 10, fontWeight: '700', letterSpacing: 1.3, color: white, backgroundColor: 'rgba(0,0,0,.35)', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20 }, cameraBottom: { position: 'absolute', bottom: 38, left: 0, right: 0, alignItems: 'center', gap: 11 }, shutterOuter: { width: 76, height: 76, borderRadius: 40, borderWidth: 4, borderColor: white, alignItems: 'center', justifyContent: 'center' }, shutterInner: { width: 58, height: 58, borderRadius: 30, backgroundColor: white }, cameraCaption: { color: white, fontSize: 12 }, cameraPermission: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 30, backgroundColor: paper }, cameraPermissionTitle: { fontSize: 25, fontWeight: '700', color: ink, marginBottom: 10 }, cameraCloseTextDummy: { color: white },
});
