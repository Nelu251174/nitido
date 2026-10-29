export const ADMIN_NOTIFICATION_CATEGORIES={registrations:'Înregistrări',operations:'Operațiuni',payments:'Plăți',quality:'Calitate',marketing:'Marketing',accounts:'Conturi'} as const;
export type AdminNotificationCategory=keyof typeof ADMIN_NOTIFICATION_CATEGORIES;
export type AdminNotificationItem={id:string;revision:string;category:AdminNotificationCategory;title:string;description:string;href:string;createdMs:number;urgent:boolean;read:boolean};
export type AdminNotificationFeed={items:AdminNotificationItem[];unread:number;total:number;offset:number;hasMore:boolean;counts:Record<AdminNotificationCategory,number>};
