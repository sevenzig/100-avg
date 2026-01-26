const ALLOWED_MIME_TYPES = ['image/png', 'image/jpeg', 'image/jpg'];
const ALLOWED_EXTENSIONS = ['.png', '.jpg', '.jpeg'];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const MIN_IMAGE_DIMENSIONS = { width: 800, height: 600 };

// Magic numbers for image file headers
const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const JPEG_MAGIC = Buffer.from([0xff, 0xd8, 0xff]);

export interface ValidationResult {
	valid: boolean;
	error?: string;
}

export function validateImageFile(file: File): ValidationResult {
	// MIME type check
	if (!ALLOWED_MIME_TYPES.includes(file.type)) {
		return { valid: false, error: 'Invalid file type. Only PNG and JPEG images are allowed.' };
	}

	// File extension check
	const extension = file.name.toLowerCase().substring(file.name.lastIndexOf('.'));
	if (!ALLOWED_EXTENSIONS.includes(extension)) {
		return { valid: false, error: 'Invalid file extension.' };
	}

	// File size check
	if (file.size > MAX_FILE_SIZE) {
		return { valid: false, error: `File size exceeds ${MAX_FILE_SIZE / 1024 / 1024}MB limit.` };
	}

	return { valid: true };
}

export async function validateImageHeader(file: File): Promise<ValidationResult> {
	// Read first bytes to verify magic numbers
	const arrayBuffer = await file.slice(0, 8).arrayBuffer();
	const header = Buffer.from(arrayBuffer);

	const isPNG = header.subarray(0, 8).equals(PNG_MAGIC);
	const isJPEG = header.subarray(0, 3).equals(JPEG_MAGIC);

	if (!isPNG && !isJPEG) {
		return { valid: false, error: 'File header does not match image format.' };
	}

	return { valid: true };
}

export function sanitizePlayerName(name: string): string {
	// Remove potentially dangerous characters, limit length
	return name
		.trim()
		.replace(/[<>\"']/g, '') // Remove HTML/script tags
		.substring(0, 50); // Limit length
}

export function validateScoreValue(value: number, category: string): boolean {
	// Validate score ranges (0-999 is reasonable for Wingspan)
	if (value < 0 || value > 999 || !Number.isInteger(value)) {
		return false;
	}
	return true;
}
