import { useState, useEffect, useRef } from 'react'
import ReactMarkdown from 'react-markdown'
import './App.css'

function App() {
  const [topic, setTopic] = useState('')
  const [explanation, setExplanation] = useState('')
  const [loading, setLoading] = useState(false)
  const [streaming, setStreaming] = useState(false)
  const [images, setImages] = useState([])
  const [imagesLoading, setImagesLoading] = useState(false)
  const [error, setError] = useState('')
  const [isListening, setIsListening] = useState(false)
  const [speechSupported, setSpeechSupported] = useState(false)
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [speechEnabled, setSpeechEnabled] = useState(true)
  const [quiz, setQuiz] = useState([])
  const [quizLoading, setQuizLoading] = useState(false)
  const [userAnswers, setUserAnswers] = useState({})
  const [quizSubmitted, setQuizSubmitted] = useState(false)
  const [score, setScore] = useState(0)
  const recognitionRef = useRef(null)
  const sentenceBufferRef = useRef('')
  const speechQueueRef = useRef([])
  const isProcessingQueueRef = useRef(false)

  useEffect(() => {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      setSpeechSupported(true)
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
      const recognition = new SpeechRecognition()
      recognition.continuous = false
      recognition.interimResults = true
      recognition.lang = 'en-US'
      
      recognition.onstart = () => {
        setIsListening(true)
      }
      
      recognition.onresult = (event) => {
        let interimTranscript = ''
        let finalTranscript = ''
        
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript
          if (event.results[i].isFinal) {
            finalTranscript += transcript
          } else {
            interimTranscript += transcript
          }
        }
        
        if (interimTranscript) {
          setTopic(interimTranscript)
        }
        if (finalTranscript) {
          setTopic(finalTranscript)
        }
      }
      
      recognition.onerror = () => {
        setIsListening(false)
      }
      
      recognition.onend = () => {
        setIsListening(false)
      }
      
      recognitionRef.current = recognition
    }
  }, [])

  const toggleListening = () => {
    if (!recognitionRef.current) return
    
    if (isListening) {
      recognitionRef.current.stop()
      setIsListening(false)
    } else {
      setTopic('')
      recognitionRef.current.start()
    }
  }

  const enqueueSentence = (text) => {
    if (!speechEnabled || !('speechSynthesis' in window)) return
    const clean = text
      .replace(/\*\*(.*?)\*\*/g, '$1')
      .replace(/\*(.*?)\*/g, '$1')
      .replace(/#{1,6}\s/g, '')
      .replace(/\n/g, ' ')
      .trim()
    if (clean.length < 15) return
    speechQueueRef.current.push(clean)
    processQueue()
  }
  
  const processQueue = () => {
    if (isProcessingQueueRef.current) return
    if (speechQueueRef.current.length === 0) {
      setIsSpeaking(false)
      return
    }
    
    isProcessingQueueRef.current = true
    setIsSpeaking(true)
    
    const text = speechQueueRef.current.shift()
    const utterance = new SpeechSynthesisUtterance(text)
    
    const voices = window.speechSynthesis.getVoices()
    const preferredVoice = voices.find(v =>
      v.name.includes('Google') && v.lang.startsWith('en')
    ) || voices.find(v =>
      v.lang.startsWith('en') && !v.name.includes('eSpeak')
    )
    if (preferredVoice) utterance.voice = preferredVoice
    
    utterance.rate = 0.95
    utterance.pitch = 1.0
    utterance.volume = 1.0
    
    utterance.onend = () => {
      isProcessingQueueRef.current = false
      processQueue()
    }
    
    utterance.onerror = () => {
      isProcessingQueueRef.current = false
      processQueue()
    }
    
    window.speechSynthesis.speak(utterance)
  }

  const stopSpeech = () => {
    window.speechSynthesis.cancel()
    speechQueueRef.current = []
    isProcessingQueueRef.current = false
    sentenceBufferRef.current = ''
    setIsSpeaking(false)
  }

  const handleAnswerSelect = (questionIndex, optionIndex) => {
    if (quizSubmitted) return
    setUserAnswers(prev => ({ ...prev, [questionIndex]: optionIndex }))
  }

  const handleQuizSubmit = () => {
    let correct = 0
    quiz.forEach((q, i) => {
      if (userAnswers[i] === q.correct_index) correct++
    })
    setScore(correct)
    setQuizSubmitted(true)
  }

  const fetchQuiz = async () => {
    if (!explanation) return
    setQuizLoading(true)
    setQuiz([])
    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 30000)
      
      const quizResponse = await fetch('https://chalkai-backend-595425747104.us-central1.run.app/generate-quiz', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic: topic, explanation: explanation }),
        signal: controller.signal
      })
      clearTimeout(timeoutId)
      
      const quizData = await quizResponse.json()
      console.log('Quiz data:', quizData)
      if (quizData.questions && quizData.questions.length > 0) {
        setQuiz(quizData.questions)
      }
    } catch (err) {
      if (err.name === 'AbortError') {
        console.error('Quiz timed out after 30 seconds')
      } else {
        console.error('Quiz error:', err)
      }
    } finally {
      setQuizLoading(false)
    }
  }

  const handleExplain = async () => {
    if (!topic.trim()) {
      setError('Please enter a topic to explain.')
      return
    }

    stopSpeech()
    setQuiz([])
    setUserAnswers({})
    setQuizSubmitted(false)
    setScore(0)
    setImages([])
    setExplanation('')
    
    setLoading(true)
    setStreaming(false)
    setError('')
    setImagesLoading(false)

    try {
      const response = await fetch('https://chalkai-backend-595425747104.us-central1.run.app/explain-stream', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ topic: topic }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.detail || 'Failed to get explanation')
      }

      setLoading(false)
      setStreaming(true)

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let result = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        const chunk = decoder.decode(value, { stream: true })
        result += chunk
        setExplanation(result)
        
        sentenceBufferRef.current += chunk
        
        const sentenceRegex = /[^.!?]*[.!?]+\s*/g
        const buffer = sentenceBufferRef.current
        const matches = buffer.match(sentenceRegex)
        
        if (matches) {
          let consumed = 0
          matches.forEach(sentence => {
            if (sentence.trim().length > 15) {
              enqueueSentence(sentence)
            }
            consumed += sentence.length
          })
          sentenceBufferRef.current = buffer.substring(consumed)
        }
      }

      setStreaming(false)

      if (sentenceBufferRef.current.trim().length > 15) {
        enqueueSentence(sentenceBufferRef.current)
        sentenceBufferRef.current = ''
      }

      try {
        setImagesLoading(true)
        const imgResponse = await fetch('https://chalkai-backend-595425747104.us-central1.run.app/generate-images', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ explanation: result, topic: topic })
        })
        
        const rawText = await imgResponse.text()
        const imgData = JSON.parse(rawText)
        
        if (imgData.images && imgData.images.length > 0) {
          setImages(imgData.images)
        }
      } catch (err) {
        console.error('Error:', err)
      } finally {
        setImagesLoading(false)
      }

      setQuizLoading(true)
      fetchQuiz()

    } catch (err) {
      setLoading(false)
      setStreaming(false)
      setImagesLoading(false)
      setError(err.message || 'An error occurred while fetching the explanation.')
    }
  }

  const renderContent = () => {
    if (!explanation) return null

    const rawParagraphs = explanation.split('\n\n')
    const paragraphs = rawParagraphs.length > 1 
      ? rawParagraphs.filter(p => p.trim() !== '')
      : explanation.split('\n').filter(p => p.trim() !== '')

    return (
      <div className="explanation-content">
        {paragraphs.map((paragraph, index) => {
          const imageForThisParagraph = images.find(img => 
            img.paragraph_index === index || 
            (img.paragraph_index === index + 1 && !images.find(i => i.paragraph_index === index))
          )
          
          return (
            <div key={index}>
              <ReactMarkdown
                components={{
                  p: ({children}) => (
                    <p style={{
                      marginBottom: '16px',
                      lineHeight: '1.85',
                      fontSize: '17px',
                      color: '#e2e8f0'
                    }}>{children}</p>
                  ),
                  strong: ({children}) => (
                    <strong style={{ color: '#c4b5fd', fontWeight: '700' }}>{children}</strong>
                  ),
                  em: ({children}) => (
                    <em style={{ color: '#93c5fd' }}>{children}</em>
                  ),
                  h1: ({children}) => (
                    <h1 style={{ color: '#a78bfa', fontSize: '24px', marginBottom: '12px' }}>{children}</h1>
                  ),
                  h2: ({children}) => (
                    <h2 style={{ color: '#a78bfa', fontSize: '20px', marginBottom: '10px' }}>{children}</h2>
                  ),
                  h3: ({children}) => (
                    <h3 style={{ color: '#a78bfa', fontSize: '18px', marginBottom: '8px' }}>{children}</h3>
                  ),
                }}
              >
                {paragraph}
              </ReactMarkdown>
              
              {imageForThisParagraph && imageForThisParagraph.svg && (
                <div style={{
                  margin: '28px auto',
                  textAlign: 'center',
                  maxWidth: '620px',
                  animation: 'fadeIn 0.8s ease-in'
                }}>
                  <div
                    style={{
                      borderRadius: '12px',
                      overflow: 'hidden',
                      boxShadow: '0 4px 24px rgba(139, 92, 246, 0.3)',
                      border: '1px solid rgba(139, 92, 246, 0.2)',
                      background: '#f8f9ff'
                    }}
                    dangerouslySetInnerHTML={{ __html: imageForThisParagraph.svg }}
                  />
                  <p style={{
                    color: '#a78bfa',
                    fontStyle: 'italic',
                    marginTop: '10px',
                    fontSize: '14px'
                  }}>
                    🎨 {imageForThisParagraph.concept}
                  </p>
                </div>
              )}
            </div>
          )
        })}
        
        {images
          .filter(img => img.paragraph_index >= paragraphs.length)
          .map((img, i) => (
            <div key={`end-img-${i}`} style={{ margin: '28px auto', textAlign: 'center', maxWidth: '620px' }}>
              {img.svg && (
                <div
                  style={{
                    borderRadius: '12px',
                    overflow: 'hidden',
                    boxShadow: '0 4px 24px rgba(139, 92, 246, 0.3)',
                    border: '1px solid rgba(139, 92, 246, 0.2)',
                    background: '#f8f9ff'
                  }}
                  dangerouslySetInnerHTML={{ __html: img.svg }}
                />
              )}
              <p style={{ color: '#a78bfa', fontStyle: 'italic', marginTop: '10px', fontSize: '14px' }}>
                🎨 {img.concept}
              </p>
            </div>
          ))
        }
      </div>
    )
  }

  return (
    <div className="app-container">
      <header className="header">
        <div className="logo-container">
          <h1 className="logo">ChalkAI</h1>
          <p className="subtitle">Speak any topic. Watch knowledge come alive.</p>
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap', marginTop: '16px' }}>
            {['🎤 Voice Input', '✍️ Live Streaming', '🎨 AI Diagrams', '🔊 Audio Narration', '🧠 Smart Quiz'].map(badge => (
              <span key={badge} style={{
                padding: '6px 14px',
                background: 'rgba(139,92,246,0.15)',
                border: '1px solid rgba(139,92,246,0.3)',
                borderRadius: '20px',
                color: '#c4b5fd',
                fontSize: '13px',
                fontWeight: '500'
              }}>{badge}</span>
            ))}
          </div>
        </div>
      </header>

      <main className="main-content">
        <div className="input-section">
          <div style={{
            display: 'flex',
            gap: '12px',
            alignItems: 'center',
            width: '100%',
            maxWidth: '800px',
            margin: '0 auto',
            flexWrap: 'wrap'
          }}>
            <div style={{ position: 'relative', flex: '1', minWidth: '250px' }}>
              <input
                type="text"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleExplain()}
                placeholder="Type or speak a topic... e.g. 'How do black holes form?'"
                style={{
                  width: '100%',
                  padding: '16px 56px 16px 20px',
                  borderRadius: '12px',
                  border: '2px solid rgba(139, 92, 246, 0.3)',
                  background: 'rgba(255,255,255,0.05)',
                  color: '#e2e8f0',
                  fontSize: '16px',
                  outline: 'none',
                  boxSizing: 'border-box',
                  transition: 'border-color 0.2s'
                }}
                onFocus={(e) => e.target.style.borderColor = 'rgba(139, 92, 246, 0.8)'}
                onBlur={(e) => e.target.style.borderColor = 'rgba(139, 92, 246, 0.3)'}
                disabled={loading || streaming}
              />
              
              {speechSupported && (
                <button
                  onClick={toggleListening}
                  title={isListening ? 'Stop listening' : 'Click to speak'}
                  style={{
                    position: 'absolute',
                    right: '12px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: isListening 
                      ? 'rgba(239, 68, 68, 0.2)' 
                      : 'rgba(139, 92, 246, 0.2)',
                    border: isListening 
                      ? '1px solid rgba(239, 68, 68, 0.5)' 
                      : '1px solid rgba(139, 92, 246, 0.5)',
                    borderRadius: '8px',
                    padding: '6px 8px',
                    cursor: 'pointer',
                    fontSize: '18px',
                    lineHeight: '1',
                    transition: 'all 0.2s'
                  }}
                >
                  {isListening ? '⏹️' : '🎤'}
                </button>
              )}
            </div>
            
            <button
              onClick={handleExplain}
              disabled={loading || streaming}
              style={{
                padding: '16px 32px',
                borderRadius: '12px',
                background: (loading || streaming) 
                  ? 'rgba(139, 92, 246, 0.4)' 
                  : 'linear-gradient(135deg, #7c3aed, #4f46e5)',
                color: 'white',
                border: 'none',
                fontSize: '16px',
                fontWeight: '700',
                cursor: (loading || streaming) ? 'not-allowed' : 'pointer',
                whiteSpace: 'nowrap',
                transition: 'all 0.2s',
                boxShadow: '0 4px 15px rgba(139, 92, 246, 0.4)'
              }}
            >
              {loading ? '⏳ Thinking...' : streaming ? '✍️ Writing...' : '✨ Explain This'}
            </button>
          </div>
          
          {isListening && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '10px',
              marginTop: '12px',
              color: '#ef4444',
              fontSize: '14px',
              animation: 'pulse 1.5s ease-in-out infinite'
            }}>
              <span style={{
                width: '10px',
                height: '10px',
                borderRadius: '50%',
                background: '#ef4444',
                display: 'inline-block',
                animation: 'pulse 1s ease-in-out infinite'
              }}></span>
              Listening... speak your topic now
            </div>
          )}
        </div>

        {loading && (
          <div style={{
            textAlign: 'center',
            color: '#a78bfa',
            fontSize: '16px',
            padding: '40px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px'
          }}>
            <span style={{ animation: 'pulse 1s infinite' }}>✨</span>
            ChalkAI is thinking
            <span style={{ letterSpacing: '2px', animation: 'pulse 1.5s infinite' }}>...</span>
          </div>
        )}

        {error && (
          <div className="error-container">
            <p className="error-message">⚠️ {error}</p>
          </div>
        )}

        {imagesLoading && (
          <div className="images-loading-container">
            <div className="shimmer-card">
              <span className="shimmer-icon">🎨</span>
              <span>Generating diagram...</span>
            </div>
            <div className="shimmer-card">
              <span className="shimmer-icon">🎨</span>
              <span>Generating diagram...</span>
            </div>
            <div className="shimmer-card">
              <span className="shimmer-icon">🎨</span>
              <span>Generating diagram...</span>
            </div>
          </div>
        )}

        {(explanation || streaming) && (
          <div className="explanation-card">
            <div className="card-header">
              <span className="card-icon">📚</span>
              <h2>Explanation</h2>
              <button
                onClick={() => {
                  setExplanation('')
                  setImages([])
                  setQuiz([])
                  setUserAnswers({})
                  setQuizSubmitted(false)
                  setScore(0)
                  stopSpeech()
                  setTopic('')
                  window.scrollTo({ top: 0, behavior: 'smooth' })
                }}
                style={{
                  marginLeft: 'auto',
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '8px',
                  padding: '6px 14px',
                  color: '#94a3b8',
                  cursor: 'pointer',
                  fontSize: '13px'
                }}
              >
                🔄 New Topic
              </button>
            </div>
            <div className="card-content">
              {explanation && (
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '10px 16px',
                  marginBottom: '16px',
                  background: 'rgba(139, 92, 246, 0.08)',
                  borderRadius: '10px',
                  border: '1px solid rgba(139, 92, 246, 0.15)'
                }}>
                  {isSpeaking && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#a78bfa', fontSize: '13px' }}>
                      <span style={{ animation: 'pulse 1s infinite' }}>🔊</span>
                      <span>Reading aloud...</span>
                      <div style={{ display: 'flex', gap: '2px', alignItems: 'center' }}>
                        {[1,2,3,4].map(i => (
                          <div key={i} style={{
                            width: '3px',
                            height: `${8 + i * 4}px`,
                            background: '#a78bfa',
                            borderRadius: '2px',
                            animation: `soundBar${i} 0.8s ease-in-out infinite`,
                            animationDelay: `${i * 0.1}s`
                          }} />
                        ))}
                      </div>
                    </div>
                  )}
                  
                  <div style={{ marginLeft: 'auto', display: 'flex', gap: '8px' }}>
                    <button
                      onClick={() => {
                        setSpeechEnabled(!speechEnabled)
                        if (isSpeaking) stopSpeech()
                      }}
                      style={{
                        background: speechEnabled ? 'rgba(139,92,246,0.2)' : 'rgba(100,100,100,0.2)',
                        border: '1px solid rgba(139,92,246,0.3)',
                        borderRadius: '8px',
                        padding: '6px 12px',
                        color: speechEnabled ? '#a78bfa' : '#666',
                        cursor: 'pointer',
                        fontSize: '13px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px'
                      }}
                    >
                      {speechEnabled ? '🔊 Audio On' : '🔇 Audio Off'}
                    </button>
                    
                    {isSpeaking && (
                      <button
                        onClick={stopSpeech}
                        style={{
                          background: 'rgba(239,68,68,0.2)',
                          border: '1px solid rgba(239,68,68,0.3)',
                          borderRadius: '8px',
                          padding: '6px 12px',
                          color: '#ef4444',
                          cursor: 'pointer',
                          fontSize: '13px'
                        }}
                      >
                        ⏹ Stop
                      </button>
                    )}
                  </div>
                </div>
              )}
              
              {renderContent()}
              {streaming && <span className="blinking-cursor">▍</span>}
            </div>
          </div>
        )}

        {(quiz.length > 0 || quizLoading) && (
          <div style={{
            marginTop: '48px',
            padding: '32px',
            background: 'rgba(139, 92, 246, 0.06)',
            borderRadius: '16px',
            border: '1px solid rgba(139, 92, 246, 0.2)'
          }}>
            <h3 style={{
              color: '#a78bfa',
              fontSize: '22px',
              marginBottom: '8px',
              display: 'flex',
              alignItems: 'center',
              gap: '10px'
            }}>
              🧠 Test Your Understanding
            </h3>
            <p style={{ color: '#64748b', fontSize: '14px', marginBottom: '28px' }}>
              Answer these questions to check what you learned
            </p>
            
            {!quizLoading && quiz.length === 0 && explanation && images.length > 0 && (
              <div style={{ textAlign: 'center', marginTop: '32px' }}>
                <button
                  onClick={fetchQuiz}
                  style={{
                    padding: '12px 28px',
                    background: 'linear-gradient(135deg, #7c3aed, #4f46e5)',
                    color: 'white',
                    border: 'none',
                    borderRadius: '10px',
                    fontSize: '15px',
                    fontWeight: '600',
                    cursor: 'pointer'
                  }}
                >
                  🧠 Generate Quiz
                </button>
              </div>
            )}
            
            {quizLoading && (
              <div style={{ color: '#64748b', textAlign: 'center', padding: '20px' }}>
                ⏳ Generating quiz questions...
              </div>
            )}
            
            {quiz.map((q, qi) => (
              <div key={qi} style={{
                marginBottom: '28px',
                padding: '20px',
                background: 'rgba(255,255,255,0.03)',
                borderRadius: '12px',
                border: '1px solid rgba(255,255,255,0.06)'
              }}>
                <p style={{
                  color: '#e2e8f0',
                  fontSize: '16px',
                  fontWeight: '600',
                  marginBottom: '16px'
                }}>
                  {qi + 1}. {q.question}
                </p>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {q.options.map((option, oi) => {
                    let bgColor = 'rgba(255,255,255,0.04)'
                    let borderColor = 'rgba(255,255,255,0.1)'
                    let textColor = '#cbd5e1'
                    
                    if (quizSubmitted) {
                      if (oi === q.correct_index) {
                        bgColor = 'rgba(34, 197, 94, 0.15)'
                        borderColor = 'rgba(34, 197, 94, 0.5)'
                        textColor = '#86efac'
                      } else if (oi === userAnswers[qi] && oi !== q.correct_index) {
                        bgColor = 'rgba(239, 68, 68, 0.15)'
                        borderColor = 'rgba(239, 68, 68, 0.5)'
                        textColor = '#fca5a5'
                      }
                    } else if (userAnswers[qi] === oi) {
                      bgColor = 'rgba(139, 92, 246, 0.2)'
                      borderColor = 'rgba(139, 92, 246, 0.6)'
                      textColor = '#c4b5fd'
                    }
                    
                    return (
                      <button
                        key={oi}
                        onClick={() => handleAnswerSelect(qi, oi)}
                        style={{
                          background: bgColor,
                          border: `1px solid ${borderColor}`,
                          borderRadius: '8px',
                          padding: '12px 16px',
                          color: textColor,
                          textAlign: 'left',
                          cursor: quizSubmitted ? 'default' : 'pointer',
                          fontSize: '15px',
                          transition: 'all 0.2s',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '10px'
                        }}
                      >
                        <span style={{
                          width: '24px',
                          height: '24px',
                          borderRadius: '50%',
                          background: 'rgba(255,255,255,0.1)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '12px',
                          fontWeight: '700',
                          flexShrink: 0
                        }}>
                          {['A','B','C','D'][oi]}
                        </span>
                        {option}
                        {quizSubmitted && oi === q.correct_index && ' ✓'}
                        {quizSubmitted && oi === userAnswers[qi] && oi !== q.correct_index && ' ✗'}
                      </button>
                    )
                  })}
                </div>
                
                {quizSubmitted && (
                  <p style={{
                    marginTop: '12px',
                    color: '#94a3b8',
                    fontSize: '13px',
                    fontStyle: 'italic',
                    padding: '10px',
                    background: 'rgba(255,255,255,0.03)',
                    borderRadius: '8px'
                  }}>
                    💡 {q.explanation}
                  </p>
                )}
              </div>
            ))}
            
            {quiz.length > 0 && !quizSubmitted && (
              <button
                onClick={handleQuizSubmit}
                disabled={Object.keys(userAnswers).length < quiz.length}
                style={{
                  marginTop: '8px',
                  padding: '14px 32px',
                  background: Object.keys(userAnswers).length < quiz.length
                    ? 'rgba(139,92,246,0.3)'
                    : 'linear-gradient(135deg, #7c3aed, #4f46e5)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '10px',
                  fontSize: '16px',
                  fontWeight: '700',
                  cursor: Object.keys(userAnswers).length < quiz.length ? 'not-allowed' : 'pointer',
                  transition: 'all 0.2s'
                }}
              >
                Submit Answers ({Object.keys(userAnswers).length}/{quiz.length} answered)
              </button>
            )}
            
            {quizSubmitted && (
              <div style={{
                marginTop: '20px',
                padding: '20px',
                background: score === quiz.length
                  ? 'rgba(34,197,94,0.1)'
                  : score >= quiz.length / 2
                    ? 'rgba(251,191,36,0.1)'
                    : 'rgba(239,68,68,0.1)',
                borderRadius: '12px',
                textAlign: 'center',
                border: '1px solid rgba(139,92,246,0.2)'
              }}>
                <div style={{ fontSize: '40px', marginBottom: '8px' }}>
                  {score === quiz.length ? '🏆' : score >= quiz.length / 2 ? '👍' : '📚'}
                </div>
                <div style={{ fontSize: '24px', fontWeight: '700', color: '#e2e8f0' }}>
                  {score} / {quiz.length} correct
                </div>
                <div style={{ color: '#94a3b8', marginTop: '6px', fontSize: '14px' }}>
                  {score === quiz.length
                    ? 'Perfect score! You mastered this topic!'
                    : score >= quiz.length / 2
                      ? 'Good job! Try explaining it again to strengthen your understanding.'
                      : 'Keep learning! Try listening to the explanation again.'}
                </div>
              </div>
            )}
            
            <div style={{ textAlign: 'center', marginTop: '24px' }}>
              <button
                onClick={fetchQuiz}
                disabled={quizLoading}
                style={{
                  padding: '10px 20px',
                  background: quizLoading ? 'rgba(139, 92, 246, 0.2)' : 'rgba(139, 92, 246, 0.1)',
                  color: '#a78bfa',
                  border: '1px solid rgba(139, 92, 246, 0.3)',
                  borderRadius: '8px',
                  fontSize: '14px',
                  fontWeight: '500',
                  cursor: quizLoading ? 'not-allowed' : 'pointer',
                  transition: 'all 0.2s'
                }}
              >
                {quizLoading ? '⏳ Generating...' : '🔄 Regenerate Quiz'}
              </button>
            </div>
          </div>
        )}
      </main>

      <footer className="footer">
        <p>Powered by Google Gemini 2.5 • Built with FastAPI + React • Google Cloud</p>
      </footer>
    </div>
  )
}

export default App
