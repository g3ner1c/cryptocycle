# cryptocycle

private encrypted period tracking

work in progress

## Cryptography

All cryptography is done with Node.js' built-in `crypto` module.

An AES-256 key is generated from the user's password using scrypt then hashed with SHA-256 and stored in `data/key.sha256`.
Encrypted data is also hashed with SHA-256 into a checksum, stored in `data/data.sha256`.
User passwords and encryption keys are never stored, only their hashes.

Every time the data is decrypted, the checksum is verified to ensure the data is not corrupted. *However, this does not guarantee that the data has not been tampered with, as the checksum can be rehashed.*

Every user login, this entire process is repeated to verify the user's password and to generate the encryption key.

```txt
user password (n bytes)
| scrypt with salt (32 + n bytes)
--> aes256 key used to encrypt/decrypt data (32 bytes) --> encrypted data is stored in data/data.enc (n bytes)
| sha256 with salt (32 + 32 bytes)                         | sha256 (n bytes)
--> salt + hash stored in data/key.sha256 (32 + 32 bytes)  --> checksum stored in data/data.sha256 (32 bytes)
    |                                                          |
    --> verifies password and encryption key                   --> verifies data integrity
```
