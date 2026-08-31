export type JobStatus =
  | "waiting"
  | "accepted"
  | "arrived"
  | "completed"
  | "cancelled"
  | "no_show";

export interface JobRow {
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
  scheduled_at: string | null;
  price_gross: number;
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
  photos?: string[];
  proofs?: { id: string; type: "ARRIVAL" | "COMPLETION"; url: string; createdAt: string }[];
  ownReview?: { rating: number; reviewText: string | null; badge: "Recenzie verificată" } | null;
}
