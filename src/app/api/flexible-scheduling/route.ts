import {NextResponse} from 'next/server';
import {flexiblePilotCity} from '@/lib/flexibleScheduling';
export function GET(){return NextResponse.json({pilotCity:flexiblePilotCity()||null},{headers:{'Cache-Control':'no-store'}});}
