'use strict';
const {randomUUID}=require('node:crypto');
const categories=['Defect/Action Needed','Marginal/Deferred Maintenance','Recommendation','Notes'];
const {ratings}=require('./ratings');
function item(name,options=[]){return {id:randomUUID(),name,options,selected:[],rating:'',note:'',limitation:''};}
function section(name,rows){return {id:randomUUID(),name,disclaimer:'',items:rows.map(r=>item(...r))};}
function seed(){return {schema:2,profile:{name:'',business:'',license:'',email:'',phone:'',address:'',website:'',logo:''},templates:[{id:randomUUID(),name:'Residential Inspection',scope:'',notice:'Read the entire report, including limitations and photographs. This report records conditions observed at the time of inspection. It is not a warranty or a prediction of future performance.',sections:[
section('Structure', [['Building type',['Single family','Townhouse','Condo']],['Foundation',['Concrete','Block','Stone','Not visible']],['Floor structure',['Wood','Steel','Concrete','Not visible']],['Walls',['Wood frame','Masonry','Not visible']]]),
section('Exterior',[['Wall covering',['Brick','Vinyl','Wood','Fiber cement']],['Grading & drainage',[]],['Deck / porch',[]],['Windows & exterior doors',[]]]),
section('Roof',[['Inspection method',['Walked','Ground','Ladder','Drone','Not accessible']],['Roof covering',['Asphalt shingles','Metal','Tile','Slate']],['Flashing',[]],['Gutters & downspouts',[]]]),
section('Attic & Insulation',[['Access',['Entered','Hatch only','Not accessible']],['Insulation',['Fiberglass','Cellulose','Spray foam','Not visible']],['Ventilation',['Ridge vent','Soffit vent','Gable vent','Fan']],['Moisture observations',[]]]),
section('Basement & Crawlspace',[['Access',['Entered','Limited entry','Not accessible','Not present']],['Visible moisture',[]],['Sump pump',[]]]),
section('Plumbing',[['Water supply',['Public','Well','Unknown']],['Supply material',['Copper','PEX','CPVC','Galvanized','Not visible']],['Drain material',['PVC','ABS','Cast iron','Not visible']],['Water heater',['Gas','Electric','Tankless']],['Fixtures & drainage',[]]]),
section('Heating',[['Operation',['Operated','Not tested in summer','Not tested - other reason']],['Fuel',['Gas','Electric','Oil','Propane','Heat pump']],['Distribution',['Forced air','Radiator','Baseboard','Other']],['Filter',[]]]),
section('Cooling',[['Operation',['Operated','Not tested in cold weather','Not tested - other reason']],['Type',['Central AC','Heat pump','Mini split','Window unit']],['Distribution',[]],['Condensate drainage',[]]]),
section('Electrical',[['Service panel',[]],['Visible wiring',['Copper','Aluminum','Not visible']],['Receptacles & GFCI',[]],['Smoke / CO alarms',[]]]),
section('Interior',[['Walls & ceilings',[]],['Floors',[]],['Doors & windows',[]],['Stairs & railings',[]]]),
section('Kitchen',[['Sink & disposal',[]],['Dishwasher',[]],['Range / cooktop',[]],['Anti-tip bracket',[]],['Ventilation',[]]]),
section('Bathrooms',[['Sink & faucet',[]],['Toilet',[]],['Tub / shower',[]],['Ventilation',[]]]),
section('Garage & Fireplace',[['Garage door & opener',[]],['Fire separation',[]],['Fireplace / chimney',[]]])]}],noteLibrary:[],reports:[]};}
module.exports={seed,categories,ratings};
