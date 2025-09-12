/**
 * Debug authentication state in browser console
 * Run this script in browser console to check authentication state
 */

console.log('🔍 DEBUGGING AUTHENTICATION STATE');
console.log('=================================');

// Check localStorage
console.log('\n📦 localStorage:');
for (let i = 0; i < localStorage.length; i++) {
  const key = localStorage.key(i);
  const value = localStorage.getItem(key);
  console.log(`${key}:`, value);
}

// Check sessionStorage
console.log('\n📦 sessionStorage:');
for (let i = 0; i < sessionStorage.length; i++) {
  const key = sessionStorage.key(i);
  const value = sessionStorage.getItem(key);
  console.log(`${key}:`, value);
}

// Check if AWS Amplify is available
console.log('\n🔧 AWS Amplify State:');
if (window.aws_amplify) {
  console.log('Amplify found:', window.aws_amplify);
} else {
  console.log('Amplify not found in window object');
}

// Try to get current auth session
console.log('\n🔒 Current Auth Session:');
if (typeof getCurrentUser !== 'undefined') {
  getCurrentUser().then(user => {
    console.log('Current User:', user);
  }).catch(err => {
    console.log('No current user:', err.message);
  });
}

// Check cookies
console.log('\n🍪 Cookies:');
console.log(document.cookie);

console.log('\n✅ Debug complete - check results above');