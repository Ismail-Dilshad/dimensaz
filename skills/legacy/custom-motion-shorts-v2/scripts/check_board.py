"""Validate the creative storyboard before rendering. Coordinates are normalized."""
import argparse
import html
import json
import math
import re
import uuid
from pathlib import Path
from urllib.parse import quote

def require(ok, message):
    if not ok:
        raise ValueError(message)

def rect(values):
    require(isinstance(values,list) and len(values)==4 and all(type(x) in (int,float) and math.isfinite(x) for x in values), "Expected four finite rectangle coordinates")
    x,y,w,h=values
    require(w>0 and h>0,"Empty rectangle")
    return x,y,x+w,y+h

def inside(box,outer):
    return all((box[0]>=outer[0]-1e-8,box[1]>=outer[1]-1e-8,box[2]<=outer[2]+1e-8,box[3]<=outer[3]+1e-8))

def overlap(a,b):
    return min(a[2],b[2])-max(a[0],b[0])>1e-8 and min(a[3],b[3])-max(a[1],b[1])>1e-8

def key(value):
    return ' '.join(re.findall(r'[^\W_]+',value.casefold()))

def check(board,folder):
    collection={"Blue Editorial","Classic","Red Signal","Apricot Miniatures","Emerald Contrast","Lavender Glass","Green Beacon","Tangerine Counter","Citron Clay","Violet Cutout"}
    layered=board["style"] in collection
    scenes=board["scenes"];require(scenes and board["style"].strip(),"Supply a style and at least one scene")
    require(scenes[0]["role"]=="hook" and scenes[-1]["role"]=="cta","Plan a hook and a closing/CTA")
    require("".join(s["copy"] for s in scenes)==board["script"],"Scene slices differ from the exact script")
    safe,art,text=(rect(board[k]) for k in ("safe","iconZone","textZone"))
    require(inside(safe,(0,0,1,1)) and inside(art,safe) and inside(text,safe) and not overlap(art,text),"Invalid safe, icon or text zone")
    used={};lines={};ids=set();rows=[]
    for s in scenes:
        art=rect(s.get("iconZone",board["iconZone"]));text=rect(s.get("textZone",board["textZone"]))
        require(inside(art,safe) and inside(text,safe) and not overlap(art,text),"Scene zones conflict with the safe frame")
        label=s["id"];require(label and label not in ids,"Duplicate or empty scene ID");ids.add(label)
        require(s["role"] in {"hook","problem","comparison","steps","stat","cta"},f"{label}: unknown role")
        duration=s["duration"];require(type(duration) in (int,float) and math.isfinite(duration) and duration>0,f"{label}: invalid hold")
        phrases=s["phrases"];require(phrases and all(p.strip() for p in phrases) and "".join(phrases)==s["copy"],f"{label}: incomplete phrase coverage")
        for i,p in enumerate(phrases):
            if i:require(phrases[i-1][-1].isspace() or p[0].isspace(),f"{label}: phrase splits a word")
            normalized=key(p)
            if normalized in lines:require(s.get("copyCallback","").strip(),f"{label}: explain repeated source phrase from {lines[normalized]}")
            lines[normalized]=label
        icons=s["icons"];require((2 if layered else 1)<=len(icons)<=(17 if layered else 4),f"{label}: need a focal asset and distinct meaningful layers")
        if layered:
            require(len({i.get("assetId") for i in icons if i.get("assetId")})>=2 and all(i.get("assetId") for i in icons),f"{label}: supply the actual distinct asset IDs")
            require(s.get("anchor","").strip() and s.get("relationship","").strip(),f"{label}: cite an anchor and describe the relationship")
        slots=[];main=0
        for i,icon in enumerate(icons):
            name=key(icon["subject"]);require(name and icon["meaning"].strip(),f"{label}: name and explain each symbol")
            if name in used:require(icon.get("callback","").strip(),f"{label}: repeated {name} from {used[name]} needs a callback")
            used[name]=label;box=rect(icon["box"]);area=(box[2]-box[0])*(box[3]-box[1])
            if not i:main=area
            elif icon.get("role","accent")!="part":
                quiet_backplate=layered and icon.get("depth")=="behind" and icon.get("quietReason","").strip() and icon.get("overlaps")
                require(area<=main*.65 or quiet_backplate,f"{label}: make {name} clearly secondary or document its low-weight backplate")
            require(inside(box,art),f"{label}: {name} outside the art zone")
            for j,p in enumerate(slots):
                if overlap(box,p):
                    require(layered and str(icon.get("overlaps",{}).get(icons[j]["subject"],"")).strip(),f"{label}: explain the contact between {name} and {icons[j]['subject']}")
            slots.append(box)
        movements=[];windows=[]
        if layered:require(bool(s["motions"]) != (s.get("holdArtwork") is True),f"{label}: choreograph the relationship or declare a still artwork hold")
        for m in sorted(s["motions"],key=lambda m:m["start"]):
            a,b=m["start"],m["end"]
            if layered:require(m["target"] in [i["subject"] for i in icons],f"{label}: unknown motion target")
            require(m["target"].strip() and m["reason"].strip() and 0<=a<b<=duration and .4-1e-8<=b-a<=.6+1e-8,f"{label}: invalid motion timing or reason")
            if m.get("dominant",True):
                require(not windows or a>=windows[-1][1]-1e-8,f"{label}: competing focal motions");windows.append((a,b))
            movements.append(f'{m["target"]} {a:g}–{b:g}s · {m["reason"]}')
        still=(folder/s["still"]).resolve()
        require(still.is_relative_to(folder.resolve()) and still.suffix.lower() in {".png",".jpg",".jpeg",".webp"} and still.is_file() and still.stat().st_size>0,f"{label}: missing scene still")
        rows.append([label+" · "+s["role"],s["copy"]," / ".join(i["subject"]+" — "+i["meaning"] for i in icons),str([i["box"] for i in icons])," / ".join(movements) or "Hold",f"{duration:g}s",still.relative_to(folder.resolve()).as_posix()])
    return rows

def main():
    parser=argparse.ArgumentParser(description=__doc__);parser.add_argument("board",type=Path);args=parser.parse_args()
    board=json.loads(args.board.read_text(encoding="utf-8-sig"));rows=check(board,args.board.parent)
    content=['<!doctype html><meta charset="utf-8"><title>Storyboard</title><style>body{font:16px system-ui;margin:2rem}table{border-collapse:collapse}td,th{padding:.7em;border:1px solid #bbb}img{width:150px}</style><h1>'+html.escape(board["style"])+'</h1><table><tr>']
    content.extend('<th>'+x+'</th>' for x in ['Section','Copy','Icons','Position','Motion','Duration','Still']);content.append('</tr>')
    for row in rows:
        content.append('<tr>'+''.join('<td dir="auto" style="white-space:pre-wrap">'+html.escape(v)+'</td>' for v in row[:-1])+'<td><img src="'+quote(row[-1])+'"></td></tr>')
    output=args.board.parent/("storyboard-"+uuid.uuid4().hex[:12]+".html")
    output.write_text(''.join(content)+'</table>',"utf8");print(output)
if __name__=="__main__":main()
