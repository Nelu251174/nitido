export type JobStatus =
  | "waiting"
  | "accepted"
  | "arrived"
  | "completed"
  | "cancelled"
  | "no_show";

export interface JobRow {
  authorizationStatus?:string|null;
  id: string;
  client_id: string;
  street: string;
  postal_code: string | null;
  city: string;
  floor: string | null;
  details?: string | null;
  client_request_id?: string | null;
  sqm: number;
  space_type: "apartament" | "casa" | "birou" | "altul";
  when_type: "asap" | "scheduled";
  mode?: "express" | "standard";
  guarantee_of?: string | null;
  // Express 60 (Pachet C): tier premium cu preluare garantată în 60 min.
  express_60?: number;
  express_60_fee?: number;
  express_60_deadline?: string | null;
  express_60_status?: "pending" | "met" | "breached" | null;
  scheduled_at: string | null;
  price_gross: number;
  pricing_snapshot?: string | null;
  credit_applied: number;
  duration_minutes: number;
  buffer_minutes: number;
  photos_count: number;
  status: JobStatus;
  accepted_firm_id: string | null;
  accepted_at: string | null;
  arrived_confirmed_at: string | null;
  completed_at: string | null;
  created_at: string;
  financial?: {paymentStatus:string;transferStatus:string;payoutStatus:string;refundStatus:string;disputeStatus:string;firmPayout?:number}|null;
  firm_payout?:number|null;
  photos?: string[];
  // Nitido Scan (Pachet C): pozele de context ale clientului, etichetate pe
  // încăpere, vizibile firmei încă din feed.
  scan?: { id: string; url: string; room: string | null; roomLabel: string }[];
  proofs?: { id: string; type: "ARRIVAL" | "COMPLETION"; url: string; createdAt: string }[];
  ownReview?: { rating: number; reviewText: string | null; badge: "Recenzie verificată" } | null;
}
