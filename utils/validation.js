function isValidPhoneNumber(phone) {
    if (!phone || typeof phone !== 'string') return false;
    const cleanPhone = phone.replace(/\D/g, '');
    return /^0[689]\d{8}$/.test(cleanPhone);
}

function isValidPIN(pin) {
    if (!pin || typeof pin !== 'string') return false;
    const cleanPin = pin.replace(/\D/g, '');
    return /^\d{4}$/.test(cleanPin);
}

function validatePhoneNumberOrThrow(phone) {
    if (!isValidPhoneNumber(phone)) {
        const error = new Error('Invalid phone number format. Must be Thai mobile number (10 digits, starting with 06, 08, or 09)');
        error.code = 'INVALID_PHONE';
        error.status = 400;
        throw error;
    }
    return phone;
}

function validatePINOrThrow(pin) {
    if (!isValidPIN(pin)) {
        const error = new Error('Invalid PIN format. Must be exactly 4 digits');
        error.code = 'INVALID_PIN';
        error.status = 400;
        throw error;
    }
    return pin;
}

class ValidationError extends Error {
    constructor(message, code = 'VALIDATION_ERROR', status = 400) {
        super(message);
        this.name = 'ValidationError';
        this.code = code;
        this.status = status;
    }
}

module.exports = {
    isValidPhoneNumber,
    isValidPIN,
    validatePhoneNumberOrThrow,
    validatePINOrThrow,
    ValidationError
};

module.exports.default = {
    isValidPhoneNumber,
    isValidPIN,
    validatePhoneNumberOrThrow,
    validatePINOrThrow,
    ValidationError
};
