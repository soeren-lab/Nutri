import{i as e,n as t,s as n,t as r}from"./createLucideIcon-NyHIPPmZ.js";import{t as i}from"./utils-DXalBF5w.js";import{t as a}from"./input-DPcy1Ual.js";var o=r(`search`,[[`path`,{d:`m21 21-4.34-4.34`,key:`14j7rj`}],[`circle`,{cx:`11`,cy:`11`,r:`8`,key:`4ej97u`}]]),s=n(e(),1),c=t();function l(e,t){(0,s.useEffect)(()=>{if(typeof document>`u`||document.getElementById(t))return;let n=document.createElement(`style`);n.id=t,n.textContent=e,document.head.appendChild(n)},[e,t])}var u=`
@property --border-beam-angle {
  syntax: "<angle>";
  initial-value: 0deg;
  inherits: false;
}

@keyframes border-beam-spin {
  from { --border-beam-angle: 0deg; }
  to { --border-beam-angle: 360deg; }
}
`;function d({className:e,size:t=200,duration:n=12,delay:r=0,colorFrom:a=`#ffaa40`,colorTo:o=`#9c40ff`,borderWidth:s=1.5,squircle:d=!1}){l(u,`border-beam-styles`);let f=d?{cornerShape:`squircle`}:{},p=Math.max(5,Math.min(180,t/4));return(0,c.jsx)(`div`,{"aria-hidden":!0,className:i(`pointer-events-none absolute inset-0 rounded-[inherit]`,e),style:{...f,padding:`${s}px`,background:`conic-gradient(from var(--border-beam-angle,0deg) at 50% 50%, transparent 0deg, ${a} ${p*.5}deg, ${o} ${p}deg, transparent ${p*1.6}deg)`,animation:`border-beam-spin ${n}s linear infinite`,animationDelay:`${r}s`,WebkitMask:`linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)`,WebkitMaskComposite:`xor`,mask:`linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)`,maskComposite:`exclude`}})}function f({className:e,containerClassName:t,onFocus:n,onBlur:r,...l}){let[u,f]=(0,s.useState)(!1);return(0,c.jsxs)(`div`,{className:i(`relative overflow-hidden rounded-md`,t),style:{boxShadow:u?`var(--beam-glow)`:void 0},children:[(0,c.jsx)(o,{className:`absolute left-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-muted-foreground`}),(0,c.jsx)(a,{...l,className:i(`pl-9 scroll-mt-0`,e),onFocus:e=>{f(!0),n?.(e)},onBlur:e=>{f(!1),r?.(e)}}),(0,c.jsx)(d,{size:u?200:150,duration:u?5:9,borderWidth:1.5,colorFrom:`var(--beam-from)`,colorTo:`var(--beam-to)`})]})}export{f as t};