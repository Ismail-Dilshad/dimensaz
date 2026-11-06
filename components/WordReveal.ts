import type {WordBox} from './TextBlock.js';
// Clone the COMPLETE shaped text run for each clipped word. No letter/word DOM
// segmentation changes Arabic joining or mixed-script bidi ordering.
export function wordReveal(text:HTMLElement,boxes:WordBox[]){
 const original=text.textContent!,base=document.createElement('div');base.style.cssText='position:absolute;inset:0;pointer-events:none;';
 const layers=boxes.map(b=>{const layer=document.createElement('div');layer.textContent=original;layer.dir=text.dir;
 layer.style.cssText='position:absolute;inset:0;white-space:pre-wrap;overflow-wrap:normal;text-align:center;unicode-bidi:plaintext;';
 const pad=4;layer.style.clipPath='inset('+Math.max(0,b.rect.y-pad)+'px '+Math.max(0,text.clientWidth-b.rect.right-pad)+'px '+Math.max(0,text.clientHeight-b.rect.bottom-pad)+'px '+Math.max(0,b.rect.x-pad)+'px)';
 base.append(layer);return layer;});
 // Keep layout and exact original string in the original text node.
 text.style.color='transparent';text.append(base);
 return {layers,render:(count:number,color:string,stagger=false)=>{layers.forEach((layer,i)=>{const p=Math.max(0,Math.min(1,count-i));layer.style.color=color;layer.style.opacity=String(p);layer.style.transform=stagger?'translateY('+((1-p)*18)+'px)':'none';});}};
}

