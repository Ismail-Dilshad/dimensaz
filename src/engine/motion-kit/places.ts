// Where a place is, for maps: a short built-in list (the region's cities in their Kurdish, Arabic
// and English names, and the world's big cities), then OpenStreetMap's search for anything else
// (read-only, once per name, remembered). Coordinates are for drawing a map, not for navigation.
import fs from 'node:fs';
import path from 'node:path';
import {ROOT} from '../config.js';

export type Place={name:string;lat:number;lon:number;source:'built-in'|'openstreetmap'|'you'};
// [names separated by |, latitude, longitude]
const BUILT_IN:[string,number,number][]=[
 ['Erbil|Hewler|Hawler|هەولێر|أربيل|اربيل',36.19,44.01],['Sulaymaniyah|Slemani|Sulaimani|سلێمانی|السليمانية',35.56,45.44],['Duhok|Dohuk|دهۆک|دهوك',36.87,42.99],
 ['Kirkuk|کەرکووک|كركوك',35.47,44.39],['Halabja|هەڵەبجە|حلبجة',35.18,45.99],['Zakho|زاخۆ|زاخو',37.14,42.68],['Akre|Aqrah|ئاکرێ',36.74,43.88],['Soran|سۆران',36.65,44.54],
 ['Ranya|Raniyah|ڕانیە',36.25,44.88],['Koya|Koysinjaq|کۆیە',36.08,44.63],['Chamchamal|چەمچەماڵ',35.53,44.83],['Kalar|کەلار',34.63,45.32],['Penjwen|پێنجوێن',35.62,45.94],
 ['Baghdad|بەغدا|بغداد',33.31,44.37],['Mosul|مووسڵ|الموصل',36.34,43.13],['Basra|بەسرە|البصرة',30.51,47.81],['Najaf|النجف',32.03,44.35],['Karbala|كربلاء',32.62,44.02],
 ['Diyarbakir|Amed|ئامەد|دیاربەکر|ديار بكر',37.91,40.24],['Qamishli|Qamishlo|قامیشلۆ|القامشلي',37.05,41.23],['Kobani|کۆبانێ|كوباني',36.89,38.36],['Mahabad|مهاباد',36.76,45.72],
 ['Sanandaj|Sine|سنە|سنندج',35.31,47.0],['Kermanshah|کرماشان|کرمانشاه',34.31,47.07],['Urmia|ورمێ|ارومیه',37.55,45.07],['Van|وان',38.5,43.38],
 ['Istanbul|ئەستەنبوڵ|إسطنبول|استانبول',41.01,28.98],['Ankara|أنقرة|آنکارا',39.93,32.86],['Tehran|تاران|طهران|تهران',35.69,51.39],['Damascus|دیمەشق|دمشق',33.51,36.29],
 ['Beirut|بيروت',33.89,35.5],['Amman|عمان',31.95,35.93],['Riyadh|الرياض',24.71,46.68],['Dubai|دبي',25.2,55.27],['Abu Dhabi|أبو ظبي',24.45,54.38],['Doha|الدوحة',25.29,51.53],
 ['Kuwait City|الكويت',29.38,47.98],['Cairo|القاهرة',30.04,31.24],['Jerusalem|القدس',31.77,35.21],['Muscat|مسقط',23.59,58.41],['Baku|باکو',40.41,49.87],['Tbilisi',41.72,44.79],
 ['Yerevan',40.18,44.51],['Athens',37.98,23.73],['Rome',41.9,12.5],['Milan',45.46,9.19],['Paris',48.86,2.35],['London|لەندەن|لندن',51.51,-0.13],['Berlin|بەرلین|برلين',52.52,13.4],
 ['Munich',48.14,11.58],['Hamburg',53.55,9.99],['Frankfurt',50.11,8.68],['Cologne',50.94,6.96],['Amsterdam',52.37,4.9],['Brussels',50.85,4.35],['Vienna',48.21,16.37],
 ['Zurich',47.38,8.54],['Geneva',46.2,6.14],['Stockholm|ستۆکهۆڵم',59.33,18.07],['Oslo',59.91,10.75],['Copenhagen',55.68,12.57],['Helsinki',60.17,24.94],['Madrid',40.42,-3.7],
 ['Barcelona',41.39,2.17],['Lisbon',38.72,-9.14],['Dublin',53.35,-6.26],['Manchester',53.48,-2.24],['Warsaw',52.23,21.01],['Prague',50.08,14.44],['Budapest',47.5,19.04],
 ['Bucharest',44.43,26.1],['Sofia',42.7,23.32],['Kyiv|Kiev',50.45,30.52],['Moscow|موسکۆ|موسكو',55.76,37.62],['New York',40.71,-74.01],['Washington',38.91,-77.04],
 ['Los Angeles',34.05,-118.24],['San Francisco',37.77,-122.42],['Chicago',41.88,-87.63],['Toronto',43.65,-79.38],['Montreal',45.5,-73.57],['Vancouver',49.28,-123.12],
 ['Mexico City',19.43,-99.13],['Sao Paulo',-23.55,-46.63],['Rio de Janeiro',-22.91,-43.17],['Buenos Aires',-34.6,-58.38],['Lagos',6.52,3.38],['Nairobi',-1.29,36.82],
 ['Johannesburg',-26.2,28.05],['Cape Town',-33.92,18.42],['Casablanca',33.57,-7.59],['Tunis',36.81,10.18],['Karachi',24.86,67.0],['Islamabad',33.68,73.05],['Delhi|New Delhi',28.61,77.21],
 ['Mumbai',19.08,72.88],['Bangalore|Bengaluru',12.97,77.59],['Dhaka',23.81,90.41],['Kabul',34.56,69.21],['Tashkent',41.3,69.24],['Almaty',43.24,76.89],['Beijing',39.9,116.41],
 ['Shanghai',31.23,121.47],['Hong Kong',22.32,114.17],['Tokyo',35.68,139.69],['Osaka',34.69,135.5],['Seoul',37.57,126.98],['Singapore',1.35,103.82],['Bangkok',13.76,100.5],
 ['Kuala Lumpur',3.14,101.69],['Jakarta',-6.21,106.85],['Manila',14.6,120.98],['Sydney',-33.87,151.21],['Melbourne',-37.81,144.96],['Auckland',-36.85,174.76],
];
const key=(s:string)=>s.normalize('NFKC').toLowerCase().replace(/[\s\-_'’.]+/g,'');
const table=new Map<string,{lat:number;lon:number}>();for(const [names,lat,lon] of BUILT_IN)for(const n of names.split('|'))table.set(key(n),{lat,lon});
const cacheFile=()=>path.resolve(ROOT,process.env.VIDEO_WORKSPACE||'workspace','cache','places.json');
const readCache=():Record<string,{lat:number;lon:number}>=>{try{return JSON.parse(fs.readFileSync(cacheFile(),'utf8'));}catch{return {};}};
/** Where a place is. "Name@36.19,44.01" gives the place yourself. */
export async function findPlace(q:string,o:{fetcher?:typeof fetch;online?:boolean}={}):Promise<Place>{
 const own=/^(.+?)@(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)$/.exec(q.trim());
 if(own){const lat=Number(own[2]),lon=Number(own[3]);if(Math.abs(lat)>85||Math.abs(lon)>180)throw new Error('Latitude is -85 to 85, longitude -180 to 180');return {name:own[1]!.trim(),lat,lon,source:'you'};}
 const name=q.trim(),hit=table.get(key(name));if(hit)return {name,...hit,source:'built-in'};
 const cache=readCache();if(cache[key(name)])return {name,...cache[key(name)]!,source:'openstreetmap'};
 if(o.online===false)throw new Error(`"${name}" is not in the built-in list. Give it yourself: "${name}@LATITUDE,LONGITUDE"`);
 const r=await (o.fetcher??fetch)(`https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(name)}`,{headers:{'user-agent':'tempoloom (open-source video tool)','accept-language':'en'}}).catch(()=>null);
 const j=r&&r.ok?await r.json().catch(()=>[]) as {lat:string;lon:string}[]:[];
 if(!j[0])throw new Error(`Could not find "${name}". Spell it as on a map, or give it yourself: "${name}@LATITUDE,LONGITUDE"`);
 const place={lat:+Number(j[0].lat).toFixed(4),lon:+Number(j[0].lon).toFixed(4)};cache[key(name)]=place;
 fs.mkdirSync(path.dirname(cacheFile()),{recursive:true});fs.writeFileSync(cacheFile(),JSON.stringify(cache,null,1)+'\n');
 return {name,...place,source:'openstreetmap'};
}
