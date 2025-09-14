// scripts/test-validation-simple.js - Simple validation test

console.log('🧪 Testing Prima789 Validation Functions...\n');

try {
  // Test validation functions
  const { 
    validatePhoneNumber, 
    validatePIN, 
    validatePhoneNumberOrThrow, 
    validatePINOrThrow,
    ValidationError 
  } = require('../utils/errors');

  console.log('1️⃣ Testing Phone Number Validation:');
  console.log('✅ 0812345678:', validatePhoneNumber('0812345678')); // Should be true
  console.log('✅ 0651234567:', validatePhoneNumber('0651234567')); // Should be true
  console.log('✅ 0912345678:', validatePhoneNumber('0912345678')); // Should be true
  console.log('❌ 0512345678:', validatePhoneNumber('0512345678')); // Should be false
  console.log('❌ 123:', validatePhoneNumber('123')); // Should be false
  console.log('❌ abc:', validatePhoneNumber('abc')); // Should be false

  console.log('\n2️⃣ Testing PIN Validation:');
  console.log('✅ 1234:', validatePIN('1234')); // Should be true
  console.log('✅ 0000:', validatePIN('0000')); // Should be true
  console.log('❌ 123:', validatePIN('123')); // Should be false
  console.log('❌ 12345:', validatePIN('12345')); // Should be false
  console.log('❌ abc1:', validatePIN('abc1')); // Should be false

  console.log('\n3️⃣ Testing Throwing Functions:');
  
  // Valid phone should not throw
  try {
    validatePhoneNumberOrThrow('0812345678');
    console.log('✅ Valid phone accepted');
  } catch (e) {
    console.log('❌ Valid phone rejected:', e.message);
  }

  // Invalid phone should throw
  try {
    validatePhoneNumberOrThrow('123');
    console.log('❌ Invalid phone should have been rejected');
  } catch (e) {
    console.log('✅ Invalid phone correctly rejected:', e.message);
  }

  // Valid PIN should not throw
  try {
    validatePINOrThrow('1234');
    console.log('✅ Valid PIN accepted');
  } catch (e) {
    console.log('❌ Valid PIN rejected:', e.message);
  }

  // Invalid PIN should throw
  try {
    validatePINOrThrow('abc');
    console.log('❌ Invalid PIN should have been rejected');
  } catch (e) {
    console.log('✅ Invalid PIN correctly rejected:', e.message);
  }

  console.log('\n🎉 All validation tests completed successfully!');

} catch (error) {
  console.error('\n💥 Test failed with error:');
  console.error('Name:', error.name);
  console.error('Message:', error.message);
  console.error('Stack:', error.stack);
  process.exit(1);
}
