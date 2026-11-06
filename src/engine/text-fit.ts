export function fitText(element:HTMLElement,max:number,min:number){
 const parent=element.parentElement!;let size=max;
 element.style.fontSize=size+'px';
 while(size>min&&(element.scrollHeight>parent.clientHeight||element.scrollWidth>parent.clientWidth)){size=Math.max(min,size-2);element.style.fontSize=size+'px';}
 if(element.scrollHeight>parent.clientHeight+1||element.scrollWidth>parent.clientWidth+1)throw new Error('Text does not fit. Split the scene or enlarge the safe area.');
 return size;
}
