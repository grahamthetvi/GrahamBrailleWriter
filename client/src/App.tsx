import { useState, useEffect, useRef } from 'react'
import './index.css'

function App() {
    const [input, setInput] = useState('')
    const [output, setOutput] = useState('')
    const [status, setStatus] = useState('Initializing...')
    const workerRef = useRef<Worker | null>(null)

    useEffect(() => {
        // Initialize worker
        workerRef.current = new Worker(new URL('./braille.worker.ts', import.meta.url), {
            type: 'module',
        })

        const worker = workerRef.current

        worker.onmessage = (e) => {
            const { type, payload } = e.data
            console.log('Worker Message:', type, payload)

            if (type === 'READY') {
                setStatus('Ready')
            } else if (type === 'TRANSLATE_RESULT') {
                setOutput(payload)
            } else if (type === 'ERROR') {
                console.error('Worker Error:', payload)
                setStatus(`Error: ${payload}`)
            }
        }

        // Start initialization
        worker.postMessage({ type: 'INIT' })

        return () => {
            worker.terminate()
        }
    }, [])

    const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const text = e.target.value
        setInput(text)

        if (workerRef.current && status === 'Ready') {
            workerRef.current.postMessage({
                type: 'TRANSLATE',
                payload: {
                    table: 'en-ueb-g2.ctb', // Default to UEB Grade 2
                    text: text,
                },
            })
        }
    }

    return (
        <div className="container">
            <h1>Braille Vibe</h1>
            <div className="status-bar">Status: {status}</div>

            <div className="editor-container">
                <div className="input-group">
                    <label htmlFor="input-text">Input Text</label>
                    <textarea
                        id="input-text"
                        value={input}
                        onChange={handleInputChange}
                        placeholder="Type here to translate..."
                    />
                </div>

                <div className="output-group">
                    <label htmlFor="output-braille">Braille Output</label>
                    <div id="output-braille" className="braille-output">
                        {output || '...'}
                    </div>
                </div>
            </div>
        </div>
    )
}

export default App
