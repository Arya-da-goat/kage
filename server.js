require('dotenv').config();
const express = require('express');
const path = require('path');
const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '1mb' }));
app.use(express.static(__dirname));
const PORT = process.env.PORT || 3000;
const MAX_HISTORY = 20;
const SYSTEM = `You are Kage AI, a professional, helpful assistant. Respond in clear, visually structured Markdown. Use headings, short paragraphs, bullet lists, tables when useful, fenced code blocks with language labels, and valid LaTeX wrapped in $...$ or $$...$$ when appropriate. For educational explanations, make the steps and key ideas easy to distinguish. Check factual consistency, calculations, code correctness, edge cases, and safety. Never claim to have executed code or verified facts when you have not. Preserve the user's intent and do not mention internal provider handoffs.`;
const configured = () => Boolean(process.env.GROQ_API_KEY || process.env.GEMINI_API_KEY || process.env.OPENAI_API_KEY);
async function timedFetch(url, options, ms=45000) {
  const controller = new AbortController(); const timer = setTimeout(()=>controller.abort(), ms);
  try { return await fetch(url, {...options, signal:controller.signal}); } finally { clearTimeout(timer); }
}
async function groq(messages) {
  const r = await timedFetch('https://api.groq.com/openai/v1/chat/completions', {method:'POST',headers:{'Content-Type':'application/json','Authorization':`Bearer ${process.env.GROQ_API_KEY}`},body:JSON.stringify({model:'llama-3.3-70b-versatile',messages,temperature:0.4,max_tokens:6000})});
  const d=await r.json(); if(!r.ok) throw new Error(d.error?.message||`Groq HTTP ${r.status}`); const out=d.choices?.[0]?.message?.content; if(!out) throw new Error('Groq returned an empty answer'); return out;
}
async function gemini(prompt, text) {
  const model='gemini-2.5-flash'; const url=`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(process.env.GEMINI_API_KEY)}`;
  const r=await timedFetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({systemInstruction:{parts:[{text:'You are the second-stage editor for Kage AI. Improve the supplied draft for correctness, clarity, professional structure and useful formatting. Fix errors and bugs in code/math where possible. Return only the improved answer, preserving the original request. Use Markdown and LaTeX when helpful.'}]},contents:[{role:'user',parts:[{text:`Original conversation:\n${prompt}\n\nDraft to review and improve:\n${text}`}]}],generationConfig:{temperature:0.25,maxOutputTokens:7000}})});
  const d=await r.json(); if(!r.ok) throw new Error(d.error?.message||`Gemini HTTP ${r.status}`); const out=d.candidates?.[0]?.content?.parts?.map(p=>p.text||'').join('').trim(); if(!out) throw new Error('Gemini returned an empty answer'); return out;
}
async function openai(prompt, text) {
  const r=await timedFetch('https://api.openai.com/v1/chat/completions',{method:'POST',headers:{'Content-Type':'application/json','Authorization':`Bearer ${process.env.OPENAI_API_KEY}`},body:JSON.stringify({model:'gpt-4o-mini',messages:[{role:'system',content:'You are the final quality-control editor for Kage AI. Verify the draft against the user request, correct mistakes and code bugs, improve completeness and professional presentation, and preserve useful details. Return only the final answer in polished Markdown. Use LaTeX when mathematically appropriate.'},{role:'user',content:`User request and context:\n${prompt}\n\nDraft to quality-check, fix and improve:\n${text}`}],temperature:0.2,max_tokens:7000})});
  const d=await r.json(); if(!r.ok) throw new Error(d.error?.message||`OpenAI HTTP ${r.status}`); const out=d.choices?.[0]?.message?.content?.trim(); if(!out) throw new Error('OpenAI returned an empty answer'); return out;
}
app.get('/api/health',(_req,res)=>res.json({configured:configured(),pipeline:['Groq','Gemini','OpenAI']}));
app.post('/api/chat',async(req,res)=>{
  const messages=Array.isArray(req.body?.messages)?req.body.messages.filter(m=>['user','assistant'].includes(m?.role)&&typeof m.content==='string').slice(-MAX_HISTORY):[];
  const userPrompt=[...messages].reverse().find(m=>m.role==='user')?.content;
  if(!userPrompt) return res.status(400).json({error:'Please enter a prompt.'});
  const math=req.body?.math ? 'Present mathematical answers with clear steps and correct LaTeX where useful.\n\n' : '';
  let answer='', lastError=null; const used=[];
  if(process.env.GROQ_API_KEY){try{answer=await groq([{role:'system',content:SYSTEM},{role:'user',content:math+messages.map(m=>`${m.role.toUpperCase()}: ${m.content}`).join('\n\n')}]);used.push('Groq');}catch(e){lastError=e;}}
  if(process.env.GEMINI_API_KEY){try{answer=await gemini(userPrompt,answer||`No previous draft was available. Answer the user request directly: ${userPrompt}`);used.push('Gemini');}catch(e){lastError=e;}}
  if(process.env.OPENAI_API_KEY){try{answer=await openai(userPrompt,answer||`No previous draft was available. Answer the user request directly: ${userPrompt}`);used.push('OpenAI');}catch(e){lastError=e;}}
  if(!answer.trim()) return res.status(503).json({error:'All configured AI providers are unavailable. Check that your API keys are valid and that the providers have quota.'});
  res.json({content:answer,providersUsed:used});
});
app.listen(PORT,()=>console.log(`Kage AI server listening on port ${PORT}`));
