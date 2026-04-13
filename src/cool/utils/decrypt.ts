import JSEncrypt from 'jsencrypt';
import CryptoJS from 'crypto-js';

/**
 * 解密服务端加密的响应数据
 * 服务端使用 AES-128-CBC 加密数据，RSA(PKCS1 v1.5) 加密 AES 密钥的 hex 字符串
 *
 * @param encryptedBody 加密的响应体 { data, aesKey, iv }
 * @param rsaPrivateKey RSA 私钥 PEM 字符串
 * @returns 解密后的原始数据对象
 */
export function decryptResponse(
	encryptedBody: { data: string; aesKey: string; iv: string },
	rsaPrivateKey: string
): any {
	try {
		// 1. RSA 私钥解密 AES 密钥（得到 hex 字符串）
		const decrypt = new JSEncrypt();
		decrypt.setPrivateKey(rsaPrivateKey);
		const aesKeyHex = decrypt.decrypt(encryptedBody.aesKey);
		if (!aesKeyHex) {
			console.error('[Decrypt] RSA 解密 AES 密钥失败');
			return null;
		}

		// 2. AES-128-CBC 解密数据
		const key = CryptoJS.enc.Hex.parse(aesKeyHex);
		const iv = CryptoJS.enc.Base64.parse(encryptedBody.iv);
		const decrypted = CryptoJS.AES.decrypt(encryptedBody.data, key, {
			iv,
			mode: CryptoJS.mode.CBC,
			padding: CryptoJS.pad.Pkcs7
		});
		const jsonStr = decrypted.toString(CryptoJS.enc.Utf8);
		if (!jsonStr) {
			console.error('[Decrypt] AES 解密数据为空');
			return null;
		}

		// 3. 解析 JSON
		return JSON.parse(jsonStr);
	} catch (err) {
		console.error('[Decrypt] 解密失败:', err);
		return null;
	}
}
