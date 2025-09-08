const { useState, useEffect, useRef } = React;

// File Explorer Component
const FileExplorer = ({ files, setFiles, setActiveFile, activeFile }) => {
    const [isCollapsed, setIsCollapsed] = useState(false);
    const addFile = () => {
        const newFile = { name: `new_file_${files.length + 1}.txt`, content: '' };
        setFiles([...files, newFile]);
        setActiveFile(newFile);
    };

    return (
        <div className={`file-explorer p-4 ${isCollapsed ? 'w-12' : 'w-48'}`}>
            <button
                className="bg-gray-700 text-white px-2 py-1 rounded hover:bg-gray-600"
                onClick={() => setIsCollapsed(!isCollapsed)}
            >
                {isCollapsed ? '>' : '<'}
            </button>
            {!isCollapsed && (
                <>
                    <h3 className="text-lg font-semibold mb-2">Files</h3>
                    <button
                        className="bg-blue-600 text-white px-2 py-1 rounded mb-2 hover:bg-blue-500"
                        onClick={addFile}
                    >
                        + New File
                    </button>
                    <ul>
                        {files.map((file, index) => (
                            <li
                                key={index}
                                className={`cursor-pointer p-1 rounded ${file.name === activeFile?.name ? 'bg-gray-600' : 'hover:bg-gray-700'}`}
                                onClick={() => setActiveFile(file)}
                            >
                                {file.name}
                            </li>
                        ))}
                    </ul>
                </>
            )}
        </div>
    );
};

// Code Editor Component
const CodeEditor = ({ activeFile, setActiveFile, language }) => {
    const editorRef = useRef(null);
    const containerRef = useRef(null);

    useEffect(() => {
        require.config({ paths: { vs: 'https://cdn.jsdelivr.net/npm/monaco-editor@0.44.0/min/vs' } });
        require(['vs/editor/editor.main'], () => {
            editorRef.current = monaco.editor.create(containerRef.current, {
                value: activeFile?.content || '',
                language: language,
                theme: 'vs-dark',
                automaticLayout: true,
                fontSize: 14,
                lineNumbers: 'on',
                minimap: { enabled: false },
            });

            editorRef.current.onDidChangeModelContent(() => {
                setActiveFile({ ...activeFile, content: editorRef.current.getValue() });
            });

            return () => editorRef.current?.dispose();
        });
    }, [activeFile, language]);

    useEffect(() => {
        if (editorRef.current && activeFile?.content !== editorRef.current.getValue()) {
            editorRef.current.setValue(activeFile?.content || '');
        }
    }, [activeFile]);

    return <div ref={containerRef} className="monaco-editor-container flex-1" />;
};

// Output Panel Component
const OutputPanel = ({ output }) => (
    <div className="output-panel p-4 h-full">
        <h3 className="text-lg font-semibold mb-2">Output</h3>
        <pre className="text-sm">{output || 'No output yet'}</pre>
    </div>
);

// Main App Component
const App = () => {
    const [language, setLanguage] = useState('python');
    const [files, setFiles] = useState([{ name: 'main.py', content: 'print("Hello, World!")' }]);
    const [activeFile, setActiveFile] = useState(files[0]);
    const [output, setOutput] = useState('');
    const [projectName, setProjectName] = useState('MyProject');
    const [status, setStatus] = useState('Idle');
    const [db, setDb] = useState(null);

    // Initialize IndexedDB
    useEffect(() => {
        const initDB = async () => {
            const database = await idb.openDB('CodeRunnerDB', 1, {
                upgrade(db) {
                    db.createObjectStore('projects', { keyPath: 'name' });
                },
            });
            setDb(database);
        };
        initDB();
    }, []);

    // Save project to IndexedDB
    const saveProject = async () => {
        if (db) {
            try {
                await db.put('projects', { name: projectName, files });
                setStatus('Project Saved Successfully');
                setTimeout(() => setStatus('Idle'), 2000);
            } catch (error) {
                setStatus('Save Failed');
                setOutput(`Error: ${error.message}`);
            }
        }
    };

    // Download project as zip
    const downloadProject = async () => {
        try {
            const zip = new JSZip();
            files.forEach(file => zip.file(file.name, file.content));
            const content = await zip.generateAsync({ type: 'blob' });
            saveAs(content, `${projectName}.zip`);
            setStatus('Project Downloaded');
            setTimeout(() => setStatus('Idle'), 2000);
        } catch (error) {
            setStatus('Download Failed');
            setOutput(`Error: ${error.message}`);
        }
    };

    // Handle file upload
    const handleFileUpload = (e) => {
        const uploadedFiles = Array.from(e.target.files);
        const readPromises = uploadedFiles.map(file => {
            return new Promise((resolve) => {
                const reader = new FileReader();
                reader.onload = (event) => {
                    resolve({ name: file.name, content: event.target.result });
                };
                reader.readAsText(file);
            });
        });

        Promise.all(readPromises).then(newFiles => {
            const updatedFiles = [...files, ...newFiles];
            setFiles(updatedFiles);
            if (newFiles.length > 0) {
                setActiveFile(newFiles[0]);
            }
        });
    };

    // Run code based on language
    const runCode = async () => {
        setStatus('Running...');
        setOutput('');
        try {
            if (language === 'python') {
                await window.pyodide.runPythonAsync(activeFile.content);
                setOutput('Execution completed. Check console for output.');
            } else if (language === 'javascript') {
                const result = eval(activeFile.content);
                setOutput(result?.toString() || 'Execution completed.');
            } else {
                setOutput('Language not supported in this demo.');
            }
            setStatus('Idle');
        } catch (error) {
            setOutput(`Error: ${error.message}`);
            setStatus('Error');
        }
    };

    // Load Pyodide for Python
    useEffect(() => {
        if (language === 'python') {
            const loadPyodide = async () => {
                window.pyodide = await loadPyodide();
                await window.pyodide.loadPackage('micropip');
            };
            loadPyodide();
        }
    }, [language]);

    return (
        <div className="flex flex-col h-screen">
            {/* Header */}
            <header className="p-4 flex justify-between items-center">
                <select
                    className="bg-gray-700 text-white p-2 rounded"
                    value={language}
                    onChange={(e) => setLanguage(e.target.value)}
                >
                    <option value="python">Python</option>
                    <option value="javascript">JavaScript</option>
                    <option value="cpp">C++</option>
                    <option value="java">Java</option>
                    <option value="ruby">Ruby</option>
                    <option value="go">Go</option>
                </select>
                <input
                    type="text"
                    className="bg-gray-700 text-white p-2 rounded"
                    value={projectName}
                    onChange={(e) => setProjectName(e.target.value)}
                    placeholder="Project Name"
                />
                <div>
                    <input type="file" multiple className="hidden" id="fileUpload" onChange={handleFileUpload} />
                    <button
                        className="bg-blue-600 text-white px-4 py-2 rounded mr-2 hover:bg-blue-500"
                        onClick={() => document.getElementById('fileUpload').click()}
                    >
                        Upload
                    </button>
                    <button
                        className="bg-blue-600 text-white px-4 py-2 rounded mr-2 hover:bg-blue-500"
                        onClick={runCode}
                    >
                        Run
                    </button>
                    <button
                        className="bg-blue-600 text-white px-4 py-2 rounded mr-2 hover:bg-blue-500"
                        onClick={saveProject}
                    >
                        Save
                    </button>
                    <button
                        className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-500"
                        onClick={downloadProject}
                    >
                        Download
                    </button>
                </div>
            </header>

            {/* Main Section */}
            <main>
                <FileExplorer files={files} setFiles={setFiles} setActiveFile={setActiveFile} activeFile={activeFile} />
                <CodeEditor activeFile={activeFile} setActiveFile={setActiveFile} language={language} />
                <OutputPanel output={output} />
            </main>

            {/* Footer */}
            <footer className="p-4 text-sm">
                Status: {status} | Version: 1.0.1
            </footer>
        </div>
    );
};

// Render the app
ReactDOM.render(<App />, document.getElementById('root'));
