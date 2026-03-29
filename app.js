import { initializeApp } from “https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js”;
import { getFirestore, collection, addDoc, doc, updateDoc, deleteDoc, query, where, getDocs } from “https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js”;

const firebaseConfig = {
apiKey: “AIzaSyAQ8wAh0gLV7-_lVEXXdIzZ7LmkMnshOiE”,
authDomain: “hf-clinic-registry.firebaseapp.com”,
projectId: “hf-clinic-registry”,
storageBucket: “hf-clinic-registry.firebasestorage.app”,
messagingSenderId: “898458296631”,
appId: “1:898458296631:web:85fea7a2c6661ae0563ab2”
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

let editingDocId = null;

// =============================================
// 1. (BMI is manual entry — no auto-calculation)
// =============================================

// =============================================
// 2. SUCCESS POPUP — created dynamically (never on page load)
// =============================================
function showSuccess(title, message, fileNo) {
// Remove any existing modal first
const existing = document.getElementById(‘successModal’);
if (existing) existing.remove();

```
const overlay = document.createElement('div');
overlay.id = 'successModal';
overlay.className = 'success-overlay';
overlay.innerHTML = `
    <div class="success-box">
        <div style="width:80px;height:80px;border-radius:50%;background:#28a745;color:white;font-size:40px;display:flex;align-items:center;justify-content:center;margin:0 auto 20px;">
            <i class="fa-solid fa-check"></i>
        </div>
        <h3 style="color:#28a745;font-weight:800;">${title}</h3>
        <p style="color:#555;font-size:0.95rem;">${message}</p>
        ${fileNo ? `<p class="fw-bold text-primary">File No: ${fileNo}</p>` : ''}
        <button class="btn btn-success fw-bold px-4 py-2" style="margin-top:15px;" id="successOkBtn">OK</button>
    </div>
`;
document.body.appendChild(overlay);

// Close on OK button
document.getElementById('successOkBtn').addEventListener('click', () => {
    overlay.remove();
});
// Close on background click
overlay.addEventListener('click', (e) => {
    if (e.target === overlay) overlay.remove();
});
```

}

// =============================================
// 3. BUILD PATIENT CARD (with PDF Export)
// =============================================
function buildPatientCard(data, docId, isNewlySaved = false) {
let detailsTable = ‘<table class="table table-sm table-bordered mt-2" style="font-size: 0.85rem;"><tbody>’;
for (let key in data) {
if (data[key] && key !== ‘timestamp’ && key !== ‘lastUpdated’) {
let cleanKey = key.replace(/_/g, ’ ’);
detailsTable += `<tr><th class="w-25 bg-light">${cleanKey}</th><td>${data[key]}</td></tr>`;
}
}
detailsTable += ‘</tbody></table>’;

```
const borderColor = isNewlySaved ? 'border-success' : 'border-primary';
const headerHtml = isNewlySaved
    ? `<div class="card-header bg-success text-white fw-bold"><i class="fa-solid fa-check-circle me-2"></i>Patient Saved Successfully</div>`
    : '';

return `
    <div class="card border ${borderColor} mb-3 shadow">
        ${headerHtml}
        <div class="card-body" id="print-area-${docId}">
            <h4 class="text-primary border-bottom pb-2">
                <i class="fa-solid fa-file-medical me-2"></i>${data.Name || 'Unknown Patient'}
            </h4>
            <p class="mb-1"><strong>File No:</strong> ${data.File_No} | <strong>Civil ID:</strong> ${data.Civil_ID}</p>
            <p class="mb-1"><strong>Entered By:</strong> <span class="badge bg-secondary">${data.Doctor_Name || 'Unknown'}</span></p>
            <p class="mb-3 text-muted"><small>Record Date: ${data.timestamp ? new Date(data.timestamp).toLocaleDateString() : new Date().toLocaleDateString()}</small></p>
            ${detailsTable}
        </div>
        <div class="card-footer bg-white border-top-0 d-flex gap-2 flex-wrap">
            <button class="btn btn-outline-primary fw-bold" onclick="window.editPatient('${docId}', '${encodeURIComponent(JSON.stringify(data))}')">
                <i class="fa-solid fa-pen-to-square me-1"></i>Edit
            </button>
            <button class="btn btn-danger fw-bold shadow-sm" onclick="window.exportPDF('print-area-${docId}', '${data.File_No}')">
                <i class="fa-solid fa-file-pdf me-1"></i>Download PDF
            </button>
            <button class="btn btn-outline-danger fw-bold" onclick="window.deletePatient('${docId}', '${data.Name || 'this patient'}')">
                <i class="fa-solid fa-trash me-1"></i>Delete
            </button>
        </div>
    </div>`;
```

}

// =============================================
// 4. SAVE OR UPDATE DATA + SUCCESS POPUP
// =============================================
document.getElementById(‘hfForm’).addEventListener(‘submit’, async (e) => {
e.preventDefault();

```
// Manual validation for mobile
const docName = document.getElementById('Doctor_Name').value;
const patName = document.getElementById('Name').value;
const civilId = document.getElementById('Civil_ID').value;
const fileNo = document.getElementById('File_No').value;

if (!docName || !patName || !civilId || !fileNo) {
    alert("⚠️ REQUIRED FIELDS MISSING:\n\n1. Doctor Name\n2. Patient Name\n3. Civil ID\n4. File No\n\nPlease fill all required fields before saving.");
    return;
}

const submitBtn = document.getElementById('submitBtn');
submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin me-2"></i>Saving...';
submitBtn.disabled = true;

const patientData = {};
const elements = document.getElementById('hfForm').elements;
for (let i = 0; i < elements.length; i++) {
    let item = elements.item(i);
    if (item.id && item.tagName !== 'BUTTON') {
        patientData[item.id] = item.value;
    }
}
patientData.lastUpdated = new Date().toISOString();

try {
    let docIdToRender = editingDocId;
    let dataToRender = { ...patientData };
    const resultsDiv = document.getElementById('searchResults');

    if (editingDocId) {
        const patientRef = doc(db, "patients", editingDocId);
        await updateDoc(patientRef, patientData);
        showSuccess(
            "Updated Successfully!",
            `Patient "${patName}" has been updated in the registry.`,
            fileNo
        );
        editingDocId = null;
        document.getElementById('formTitle').innerHTML = '<i class="fa-solid fa-user-plus me-2 text-danger"></i>New Patient Entry';
        document.getElementById('cancelEditBtn').classList.add('d-none');
    } else {
        patientData.timestamp = new Date().toISOString();
        dataToRender.timestamp = patientData.timestamp;
        const docRef = await addDoc(collection(db, "patients"), patientData);
        docIdToRender = docRef.id;
        showSuccess(
            "Saved Successfully!",
            `New patient "${patName}" has been added to the registry.`,
            fileNo
        );
    }

    // Show patient card with PDF button
    resultsDiv.innerHTML = buildPatientCard(dataToRender, docIdToRender, true);

    document.getElementById('hfForm').reset();
    submitBtn.innerHTML = '<i class="fa-solid fa-cloud-arrow-up me-2"></i>Save Patient to Registry';
    submitBtn.disabled = false;

    window.scrollTo({ top: 0, behavior: 'smooth' });

} catch (error) {
    console.error("Error saving: ", error);
    alert("❌ Error saving data. Please check your internet connection and try again.");
    submitBtn.innerHTML = '<i class="fa-solid fa-cloud-arrow-up me-2"></i>Save Patient to Registry';
    submitBtn.disabled = false;
}
```

});

// =============================================
// 5. SEARCH
// =============================================
document.getElementById(‘searchBtn’).addEventListener(‘click’, async () => {
const searchTerm = document.getElementById(‘searchInput’).value.trim();
const resultsDiv = document.getElementById(‘searchResults’);
resultsDiv.innerHTML = “<div class='text-primary fw-bold'><i class='fa-solid fa-spinner fa-spin me-2'></i>Searching…</div>”;

```
if (!searchTerm) {
    resultsDiv.innerHTML = "<span class='text-danger'>Enter a Civil ID or File No to search.</span>";
    return;
}

try {
    const patientsRef = collection(db, "patients");
    let q = query(patientsRef, where("Civil_ID", "==", searchTerm));
    let querySnapshot = await getDocs(q);

    if (querySnapshot.empty) {
        q = query(patientsRef, where("File_No", "==", searchTerm));
        querySnapshot = await getDocs(q);
    }

    if (querySnapshot.empty) {
        resultsDiv.innerHTML = "<div class='alert alert-warning fw-bold'>No patient found matching that ID.</div>";
    } else {
        resultsDiv.innerHTML = "";
        querySnapshot.forEach((docSnap) => {
            resultsDiv.innerHTML += buildPatientCard(docSnap.data(), docSnap.id, false);
        });
    }
} catch (error) {
    resultsDiv.innerHTML = "<div class='alert alert-danger'>Error searching. Please try again.</div>";
}
```

});

// =============================================
// 6. ADMIN PANEL (with Edit, Delete, PDF per row)
// =============================================
document.getElementById(‘adminBtn’).addEventListener(‘click’, async () => {
const pin = prompt(“Enter Admin PIN:”);
if (pin !== “1234”) {
if (pin !== null) alert(“Incorrect PIN.”);
return;
}

```
const adminPanel = document.getElementById('adminPanel');
const tbody = document.getElementById('adminTableBody');
const totalSpan = document.getElementById('totalPatients');
tbody.innerHTML = "<tr><td colspan='6' class='text-center py-4'><i class='fa-solid fa-spinner fa-spin fa-2x text-primary'></i><br>Loading Database...</td></tr>";
adminPanel.classList.remove('d-none');
window.scrollTo({ top: 0, behavior: 'smooth' });

try {
    const querySnapshot = await getDocs(collection(db, "patients"));
    tbody.innerHTML = "";
    totalSpan.innerText = querySnapshot.size;

    if (querySnapshot.empty) {
        tbody.innerHTML = "<tr><td colspan='6' class='text-center py-3'>No patients in the database yet.</td></tr>";
        return;
    }

    querySnapshot.forEach((docSnap) => {
        const data = docSnap.data();
        const docId = docSnap.id;
        const dateStr = data.timestamp ? new Date(data.timestamp).toLocaleDateString() : 'N/A';
        
        // Store data on a global cache to avoid inline encoding issues
        if (!window._patientCache) window._patientCache = {};
        window._patientCache[docId] = data;

        const safeName = (data.Name || 'Unknown').replace(/'/g, "\\'").replace(/"/g, '&quot;');

        tbody.innerHTML += `
            <tr id="admin-row-${docId}">
                <td class="fw-bold text-primary">${data.File_No || 'N/A'}</td>
                <td>${data.Name || 'N/A'}</td>
                <td>${data.Civil_ID || 'N/A'}</td>
                <td><span class="badge bg-secondary">${data.Doctor_Name || 'Unknown'}</span></td>
                <td>${dateStr}</td>
                <td>
                    <div class="btn-group btn-group-sm" role="group">
                        <button class="btn btn-outline-primary" title="Edit" onclick="window.editFromCache('${docId}')">
                            <i class="fa-solid fa-pen-to-square"></i>
                        </button>
                        <button class="btn btn-outline-danger" title="Delete" onclick="window.deletePatient('${docId}', '${safeName}')">
                            <i class="fa-solid fa-trash"></i>
                        </button>
                        <button class="btn btn-outline-dark" title="PDF" onclick="window.exportFromCache('${docId}')">
                            <i class="fa-solid fa-file-pdf"></i>
                        </button>
                    </div>
                </td>
            </tr>`;
    });
} catch (err) {
    tbody.innerHTML = "<tr><td colspan='6' class='text-danger'>Error loading database.</td></tr>";
}
```

});

document.getElementById(‘closeAdminBtn’).addEventListener(‘click’, () => {
document.getElementById(‘adminPanel’).classList.add(‘d-none’);
});

// =============================================
// 7. GLOBAL FUNCTIONS
// =============================================

// EDIT PATIENT — loads data into form
window.editPatient = function (docId, dataString) {
const data = JSON.parse(decodeURIComponent(dataString));
editingDocId = docId;

```
for (let key in data) {
    if (document.getElementById(key)) {
        document.getElementById(key).value = data[key];
    }
}

document.getElementById('formTitle').innerHTML = '<i class="fa-solid fa-pen-to-square me-2 text-primary"></i>Editing Patient: ' + (data.Name || '');
document.getElementById('submitBtn').innerHTML = '<i class="fa-solid fa-floppy-disk me-2"></i>Update Patient Data';
document.getElementById('cancelEditBtn').classList.remove('d-none');
document.getElementById('adminPanel').classList.add('d-none');
document.getElementById('hfForm').scrollIntoView({ behavior: 'smooth' });
```

};

// CANCEL EDIT
document.getElementById(‘cancelEditBtn’).addEventListener(‘click’, () => {
editingDocId = null;
document.getElementById(‘hfForm’).reset();
document.getElementById(‘formTitle’).innerHTML = ‘<i class="fa-solid fa-user-plus me-2 text-danger"></i>New Patient Entry’;
document.getElementById(‘submitBtn’).innerHTML = ‘<i class="fa-solid fa-cloud-arrow-up me-2"></i>Save Patient to Registry’;
document.getElementById(‘cancelEditBtn’).classList.add(‘d-none’);
});

// DELETE PATIENT — with confirmation
window.deletePatient = async function (docId, patientName) {
const confirmed = confirm(`⚠️ DELETE PATIENT\n\nAre you sure you want to permanently delete "${patientName}"?\n\nThis action CANNOT be undone.`);
if (!confirmed) return;

```
try {
    await deleteDoc(doc(db, "patients", docId));
    showSuccess(
        "Deleted Successfully",
        `Patient "${patientName}" has been removed from the registry.`,
        null
    );

    // Remove row from admin table if visible
    const row = document.getElementById('admin-row-' + docId);
    if (row) row.remove();

    // Update count
    const totalSpan = document.getElementById('totalPatients');
    const currentCount = parseInt(totalSpan.innerText) || 0;
    if (currentCount > 0) totalSpan.innerText = currentCount - 1;

    // Clear search results if patient was displayed there
    const resultsDiv = document.getElementById('searchResults');
    if (resultsDiv.innerHTML.includes(docId)) {
        resultsDiv.innerHTML = "<div class='alert alert-info'>Patient deleted. Search again for updated results.</div>";
    }

} catch (error) {
    console.error("Error deleting: ", error);
    alert("❌ Error deleting patient. Please check your connection and try again.");
}
```

};

// PDF EXPORT — from patient card
window.exportPDF = function (elementId, fileNo) {
const element = document.getElementById(elementId);
if (!element) {
alert(“❌ Cannot find patient data to export.”);
return;
}
element.classList.remove(‘card-body’);
const opt = {
margin: 0.5,
filename: `HF_Clinic_Report_${fileNo}.pdf`,
image: { type: ‘jpeg’, quality: 0.98 },
html2canvas: { scale: 2 },
jsPDF: { unit: ‘in’, format: ‘letter’, orientation: ‘portrait’ }
};
html2pdf().set(opt).from(element).save().then(() => {
element.classList.add(‘card-body’);
});
};

// ADMIN — Edit from cache (safe, no inline encoding)
window.editFromCache = function (docId) {
const data = window._patientCache && window._patientCache[docId];
if (!data) {
alert(“❌ Could not load patient data. Please reload the Admin panel.”);
return;
}
editingDocId = docId;

```
for (let key in data) {
    if (document.getElementById(key)) {
        document.getElementById(key).value = data[key];
    }
}

document.getElementById('formTitle').innerHTML = '<i class="fa-solid fa-pen-to-square me-2 text-primary"></i>Editing Patient: ' + (data.Name || '');
document.getElementById('submitBtn').innerHTML = '<i class="fa-solid fa-floppy-disk me-2"></i>Update Patient Data';
document.getElementById('cancelEditBtn').classList.remove('d-none');
document.getElementById('adminPanel').classList.add('d-none');
document.getElementById('hfForm').scrollIntoView({ behavior: 'smooth' });
```

};

// ADMIN — Export PDF from cache
window.exportFromCache = function (docId) {
const data = window._patientCache && window._patientCache[docId];
if (!data) {
alert(“❌ Could not load patient data. Please reload the Admin panel.”);
return;
}

```
const tempId = 'admin-print-' + docId;
let tempDiv = document.getElementById(tempId);
if (tempDiv) tempDiv.remove();

tempDiv = document.createElement('div');
tempDiv.id = tempId;
tempDiv.style.position = 'absolute';
tempDiv.style.left = '-9999px';
tempDiv.style.top = '0';
tempDiv.style.width = '800px';
tempDiv.style.background = 'white';
tempDiv.style.padding = '20px';

let tableRows = '';
for (let key in data) {
    if (data[key] && key !== 'timestamp' && key !== 'lastUpdated') {
        let cleanKey = key.replace(/_/g, ' ');
        tableRows += `<tr><th style="background:#f8f9fa;width:30%;padding:6px 10px;border:1px solid #dee2e6;font-size:13px;">${cleanKey}</th><td style="padding:6px 10px;border:1px solid #dee2e6;font-size:13px;">${data[key]}</td></tr>`;
    }
}

tempDiv.innerHTML = `
    <div style="text-align:center;margin-bottom:20px;">
        <h2 style="color:#8b0000;margin:0;">Mubarak Al-Kabeer Hospital</h2>
        <h4 style="color:#555;margin:5px 0;">Heart Failure Clinic — Patient Report</h4>
        <hr style="border-color:#8b0000;">
    </div>
    <h3 style="color:#0d6efd;">${data.Name || 'Unknown Patient'}</h3>
    <p><strong>File No:</strong> ${data.File_No || 'N/A'} &nbsp;|&nbsp; <strong>Civil ID:</strong> ${data.Civil_ID || 'N/A'}</p>
    <p><strong>Entered By:</strong> ${data.Doctor_Name || 'Unknown'} &nbsp;|&nbsp; <strong>Date:</strong> ${data.timestamp ? new Date(data.timestamp).toLocaleDateString() : 'N/A'}</p>
    <table style="width:100%;border-collapse:collapse;margin-top:15px;">${tableRows}</table>
`;

document.body.appendChild(tempDiv);

const opt = {
    margin: 0.5,
    filename: `HF_Clinic_Report_${data.File_No || 'unknown'}.pdf`,
    image: { type: 'jpeg', quality: 0.98 },
    html2canvas: { scale: 2 },
    jsPDF: { unit: 'in', format: 'letter', orientation: 'portrait' }
};

html2pdf().set(opt).from(tempDiv).save().then(() => {
    tempDiv.remove();
});
```

};
