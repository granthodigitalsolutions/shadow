const fs = require('fs');
let c = fs.readFileSync('frontend/src/app/App.tsx','utf8');
c = c.replace('const SecretaryStudentManagement = lazyWithRetry(() => import("./components/secretary/SecretaryStudentManagement"));', 'const SecretaryStudentManagement = lazyWithRetry(() => import("./components/secretary/SecretaryStudentManagement"));\nconst SecretaryFeeRequest      = lazyWithRetry(() => import("./components/secretary/SecretaryFeeRequest"));');
c = c.replace('const FeeStructure             = lazyWithRetry(() => import("./components/admin/FeeStructure"));', 'const FeeStructure             = lazyWithRetry(() => import("./components/admin/FeeStructure"));\nconst SchoolFeeRequests        = lazyWithRetry(() => import("./components/admin/SchoolFeeRequests"));');
c = c.replace('{ path: "/admin/:program/fee-structure",                    element: <FeeStructure /> },', '{ path: "/admin/:program/fee-structure",                    element: <FeeStructure /> },\n      { path: "/admin/:program/school-fees",                      element: <SchoolFeeRequests /> },');
c = c.replace('{ path: "/secretary/students",       element: <SecretaryStudentManagement /> },', '{ path: "/secretary/students",       element: <SecretaryStudentManagement /> },\n      { path: "/secretary/fee-requests",   element: <SecretaryFeeRequest /> },');
fs.writeFileSync('frontend/src/app/App.tsx', c);
console.log('App.tsx updated');
