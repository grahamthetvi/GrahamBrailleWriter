// braille.worker.ts

// Global scope for worker
declare const self: Worker;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
declare const importScripts: (...urls: string[]) => void;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
declare let liblouisBuild: any;

let liblouis: any = null;

async function loadTable(tableName: string) {
    if (!liblouis) return;
    try {
        const response = await fetch(`/liblouis-build/${tableName}`);
        if (!response.ok) throw new Error(`Failed to fetch ${tableName}`);
        const buffer = await response.arrayBuffer();
        liblouis.FS.writeFile(`/${tableName}`, new Uint8Array(buffer));
        console.log(`Loaded table: ${tableName}`);
    } catch (err: any) {
        console.error(`Error loading table ${tableName}:`, err);
        throw err;
    }
}

async function init() {
    try {
        importScripts('/liblouis-build/liblouis.js');

        console.log('LibLouis script loaded');

        // Initialize the module
        liblouis = await liblouisBuild({
            locateFile: (path: string) => `/liblouis-build/${path}`,
            print: (text: string) => console.log('LibLouis:', text),
            printErr: (text: string) => console.warn('LibLouis Err:', text),
            // Emscripten specific setup if needed
        });

        console.log('LibLouis Module initialized');

        // Check version if possible
        if (liblouis._lou_version) {
            const versionPtr = liblouis._lou_version();
            const version = liblouis.UTF8ToString(versionPtr);
            console.log('LibLouis Version:', version);
        }

        // Load default tables
        await loadTable('en-ueb-g2.ctb');
        await loadTable('en-us-g1.ctb');

        self.postMessage({ type: 'READY' });
    } catch (error: any) {
        console.error('Failed to initialize LibLouis:', error);
        self.postMessage({ type: 'ERROR', payload: error.toString() });
    }
}

self.onmessage = async (e: MessageEvent) => {
    const { type, payload } = e.data;

    if (type === 'INIT') {
        await init();
    } else if (type === 'TRANSLATE') {
        if (!liblouis) {
            self.postMessage({ type: 'ERROR', payload: 'LibLouis not initialized' });
            return;
        }

        const { table, text } = payload;

        try {
            // Helpers for widechar (assuming UTF-16 for JS compatibility, though LibLouis native is often UTF-32)
            // If the user's build is UTF-32, we might need to adjust.
            // checking liblouis.stringToUTF16 or liblouis.stringToUTF32 availability would be ideal.
            // We'll try UTF-16 first as it maps well to JS strings.

            const writeWideString = (str: string, ptr: number) => {
                if (liblouis.stringToUTF16) {
                    liblouis.stringToUTF16(str, ptr, str.length * 2 + 2);
                } else if (liblouis.stringToUTF32) {
                    liblouis.stringToUTF32(str, ptr, str.length * 4 + 4);
                } else {
                    // Fallback manual write (UTF-16)
                    for (let i = 0; i < str.length; i++) {
                        liblouis.setValue(ptr + i * 2, str.charCodeAt(i), 'i16');
                    }
                    liblouis.setValue(ptr + str.length * 2, 0, 'i16');
                }
            };

            const readWideString = (ptr: number, len: number) => {
                if (liblouis.UTF16ToString) {
                    // Note: UTF16ToString usually takes bytes, so len might need adjustment or it takes elements?
                    // Emscripten UTF16ToString takes ptr.
                    return liblouis.UTF16ToString(ptr);
                }
                if (liblouis.UTF32ToString) {
                    return liblouis.UTF32ToString(ptr);
                }
                // Fallback manual read
                let res = '';
                for (let i = 0; i < len; i++) {
                    const code = liblouis.getValue(ptr + i * 2, 'i16');
                    if (code === 0) break;
                    res += String.fromCharCode(code);
                }
                return res;
            };

            const charSize = liblouis.stringToUTF32 ? 4 : 2;

            // 1. Prepare Table List (char*)
            const tableStr = table + "\0";
            const tablePtr = liblouis._malloc(tableStr.length);
            liblouis.stringToUTF8(table, tablePtr, tableStr.length);

            // 2. Prepare Input (widechar*)
            const inputLen = text.length;
            const inputPtr = liblouis._malloc((inputLen + 1) * charSize);
            writeWideString(text, inputPtr);

            // 3. Prepare Output (widechar*)
            // Braille expansion is rarely > 2x, but safety first.
            const maxOutLen = inputLen * 4 + 100;
            const outputPtr = liblouis._malloc(maxOutLen * charSize);

            // 4. Prepare Lengths (int*)
            const inLenPtr = liblouis._malloc(4);
            const outLenPtr = liblouis._malloc(4);
            liblouis.setValue(inLenPtr, inputLen, 'i32');
            liblouis.setValue(outLenPtr, maxOutLen, 'i32');

            // 5. Call lou_translateString
            // int lou_translateString(const char *tableList, const widechar *inbuf, int *inlen, widechar *outbuf, int *outlen, typeform *typeform, char *spacing, int mode);
            const ret = liblouis._lou_translateString(
                tablePtr,
                inputPtr,
                inLenPtr,
                outputPtr,
                outLenPtr,
                0, // typeform
                0, // spacing
                0  // mode
            );

            if (ret === 0) {
                // Translation failed (0 usually means 0 chars or error, but here it often implies error if input > 0)
                // But check inLenPtr could be useful.
            }

            const realOutLen = liblouis.getValue(outLenPtr, 'i32');
            const result = readWideString(outputPtr, realOutLen);

            // 6. Cleanup
            liblouis._free(tablePtr);
            liblouis._free(inputPtr);
            liblouis._free(outputPtr);
            liblouis._free(inLenPtr);
            liblouis._free(outLenPtr);

            self.postMessage({ type: 'TRANSLATE_RESULT', payload: result });

        } catch (error: any) {
            console.error('Translation failed:', error);
            self.postMessage({ type: 'ERROR', payload: error.toString() });
        }
    }
};
