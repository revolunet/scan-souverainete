export interface IpInfo {
  ip: string;
  hostname: string | null;
  organization: string | null;
  country: string | null;
  country_name: string | null;
}

export interface MxRecord {
  host: string;
  priority: number;
  ip_info: IpInfo | null;
}

export interface Cookie {
  domain: string;
  name: string;
  value: string;
  path: string;
  expiration: number;
  ip_info: IpInfo | null;
}

export interface ExternalResource {
  type: string;
  url: string;
  ip_info: IpInfo | null;
}

export interface UrlResult {
  url: string;
  final_url: string;
  hostname: string;
  ip_info: IpInfo | null;
  mx: MxRecord[];
  resources: ExternalResource[];
  cookies: Cookie[];
  timestamp: string;
}

export interface SummaryStats {
  total: number;
  success: number;
  failed: number;
}

export interface NonFrDependency {
  source_url: string;
  domain: string;
  organization: string | null;
  country: string | null;
  country_name: string | null;
}

export interface NonFrHostingEntry {
  url: string;
  hostname: string;
  organization: string | null;
  country: string | null;
  country_name: string | null;
}

export interface Summary {
  timestamp: string;
  stats: SummaryStats;
  hosting: {
    countries: Record<string, number>;
    organizations: Record<string, number>;
    organizations_country: Record<string, string>;
  };
  dependencies: Record<string, number>;
  dependencies_by_country: Record<string, number>;
  non_fr_dependencies: NonFrDependency[];
  non_fr_hosted_urls: NonFrHostingEntry[];
  non_fr_mx_urls: NonFrHostingEntry[];
  mx_hosters: Record<string, number>;
  mx_hosters_country: Record<string, string>;
}

export interface HosterEntry {
  patterns: string[];
  organization: string;
  country: string;
  country_name: string;
}
