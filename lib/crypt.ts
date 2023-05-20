import * as crypto from "crypto";
import * as fs from "fs";
import * as readlineSync from "readline-sync";

interface Key {
    salt: Buffer;
    key: Buffer;
    hash: Buffer;
}

export function sha256(data: Buffer): Buffer {
    return crypto.createHash("sha256").update(data).digest();
}

function pswd2key(pwsd: string, salt: Buffer = crypto.randomBytes(32)): Key {
    // user password
    // | scrypt with salt + pswd (32 + n bytes)
    // --> aes256 key used to encrypt/decrypt data (32 bytes)
    // | sha256 with salt + key (32 + 32 bytes)
    // --> salt + hash stored in data/key.sha256 (32 + 32 bytes)

    const key = crypto.scryptSync(pwsd, salt, 32, { N: 2 ** 14, r: 8, p: 1 });
    const hash = sha256(Buffer.concat([salt, key]));
    return {
        salt: salt,
        key: key,
        hash: hash,
    };
}

export function login(): Buffer | undefined {
    if (!fs.existsSync("data/key.sha256")) {
        if (!fs.existsSync("data")) {
            fs.mkdirSync("data");
        }

        let pswd = readlineSync.question("Set password: ", {
            hideEchoBack: true,
        });

        if (pswd != readlineSync.question("Confirm password: ", { hideEchoBack: true })) {
            console.log("Passwords do not match!");
            return;
        }

        var { salt, key, hash } = pswd2key(pswd);
        fs.writeFileSync("data/key.sha256", Buffer.concat([salt, hash]));
    } else {
        let pswd = readlineSync.question("Enter password: ", {
            hideEchoBack: true,
        });

        const data: Buffer = fs.readFileSync("data/key.sha256");
        var { salt, key, hash } = pswd2key(pswd, data.subarray(0, 32));

        if (hash.equals(data.subarray(32))) {
            console.log("Welcome!");
        } else {
            console.log("Wrong password!");
            return;
        }
    }

    return key;
}

// encrypt and decrypt with aes-256-cbc
export function encrypt(key: Buffer, data: Buffer): Buffer {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv("aes-256-cbc", key, iv);
    const encrypted = Buffer.concat([cipher.update(data), cipher.final()]);
    return Buffer.concat([iv, encrypted]);
}

export function decrypt(key: Buffer, data: Buffer): Buffer {
    const iv = data.subarray(0, 16);
    const encrypted = data.subarray(16);
    const decipher = crypto.createDecipheriv("aes-256-cbc", key, iv);
    const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
    return decrypted;
}
