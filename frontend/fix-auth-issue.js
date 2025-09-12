/**
 * COMPREHENSIVE AUTHENTICATION FIX SCRIPT
 * Run this in browser console to fix authentication issues
 */

async function fixAuthenticationIssues() {
  console.log('🔧 FIXING AUTHENTICATION ISSUES');
  console.log('=================================');
  
  // Step 1: Clear all browser storage
  console.log('\n1️⃣ Clearing browser storage...');
  
  // Clear localStorage
  const localStorageKeys = Object.keys(localStorage);
  localStorageKeys.forEach(key => {
    console.log(`   Removing localStorage: ${key}`);
    localStorage.removeItem(key);
  });
  
  // Clear sessionStorage
  const sessionStorageKeys = Object.keys(sessionStorage);
  sessionStorageKeys.forEach(key => {
    console.log(`   Removing sessionStorage: ${key}`);
    sessionStorage.removeItem(key);
  });
  
  // Clear cookies
  console.log('   Clearing cookies...');
  document.cookie.split(";").forEach(function(c) { 
    document.cookie = c.replace(/^ +/, "").replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/"); 
  });
  
  // Step 2: Check current auth state
  console.log('\n2️⃣ Checking current authentication state...');
  
  try {
    // Try to get current user
    const { getCurrentUser } = await import('aws-amplify/auth');
    const currentUser = await getCurrentUser();
    console.log('✅ Current user:', currentUser.username);
    
    // Try to get auth session
    const { fetchAuthSession } = await import('aws-amplify/auth');
    const session = await fetchAuthSession();
    
    if (session.tokens?.idToken) {
      console.log('✅ ID Token available');
      console.log('   Token preview:', session.tokens.idToken.toString().substring(0, 50) + '...');
    } else {
      console.log('❌ No ID Token available');
    }
    
  } catch (error) {
    console.log('❌ Not authenticated:', error.message);
    console.log('\n⚠️ You need to sign in with AWS Cognito!');
    console.log('   Please reload the page and use the login form.');
  }
  
  // Step 3: Test API without authentication
  console.log('\n3️⃣ Testing API without authentication (should get 401)...');
  
  try {
    const response = await fetch('http://localhost:8000/api/v1/printer-config/', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    console.log('   Response status:', response.status);
    if (response.status === 401) {
      console.log('✅ Backend correctly rejects unauthenticated requests');
    } else {
      console.log('❌ Backend should return 401 for unauthenticated requests');
    }
    
  } catch (error) {
    console.log('   Network error:', error.message);
  }
  
  console.log('\n🔄 NEXT STEPS:');
  console.log('1. Reload the page (press F5 or Ctrl/Cmd + R)');
  console.log('2. You should see the AWS Cognito login screen');
  console.log('3. Sign in with your credentials');
  console.log('4. Try accessing printer configuration again');
  console.log('\n✅ Fix script completed');
  
  return {
    storageCleared: true,
    recommendation: 'Reload page and sign in with Cognito'
  };
}

// Export function to global scope
window.fixAuthenticationIssues = fixAuthenticationIssues;

// Also create a simple test function
window.testPrinterAPI = async () => {
  console.log('🧪 Testing Printer API...');
  
  try {
    const { fetchAuthSession } = await import('aws-amplify/auth');
    const session = await fetchAuthSession();
    
    if (!session.tokens?.idToken) {
      console.log('❌ No authentication token - please sign in first');
      return { error: 'Not authenticated' };
    }
    
    const response = await fetch('http://localhost:8000/api/v1/printer-config/', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.tokens.idToken}`
      }
    });
    
    console.log('Response status:', response.status);
    
    if (response.ok) {
      const data = await response.json();
      console.log('✅ Printer API working correctly:', data);
      return { success: true, data };
    } else {
      const errorData = await response.text();
      console.log('❌ API Error:', errorData);
      return { error: errorData, status: response.status };
    }
    
  } catch (error) {
    console.log('❌ Error testing API:', error.message);
    return { error: error.message };
  }
};

console.log('🔧 Authentication fix tools loaded!');
console.log('📋 Available functions:');
console.log('   - fixAuthenticationIssues(): Clear storage and diagnose auth issues');
console.log('   - testPrinterAPI(): Test printer API with current authentication');
console.log('\n💡 Start with: fixAuthenticationIssues()');