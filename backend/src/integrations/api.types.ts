export interface CarbonRegion {
  code: string;
  country: string;
  region: string;
  city: string;
  latitude: number;
  longitude: number;
  carbon_intensity_gco2e_per_kwh: number;
  renewable_share_percent: number;
}
export interface ListCarbon{
    regions:CarbonRegion[]
    total:number;
}

export interface ServiceMetrics{
    id: string,
    name: string,
    location: {
        region_code: string,
        country: string,
        region: string,
        city: string,
        latitude: number,
        longitude: number
    },
    metrics_path: string
}

export interface Metric{
    collection_interval_seconds: number,
    metrics: {
        cpu_percent: number,
        memory_gb: number,
        disk_gb: number,
        network_gb: number
    }
}

export interface ApiError{
    name:string
    statusCode:number
    code:string
    
}
