import api from "@/lib/api";

export interface ServiceCategory {
  id: number;
  name: string;
  slug: string;
  description: string;
  icon: string;
  tier_required: string;
  example_tasks: string[];
  default_tasks: string[];
  sort_order: number;
}

interface ServiceCategoryListResponse {
  data: ServiceCategory[];
}

export async function fetchServiceCategories(): Promise<ServiceCategory[]> {
  const res = await api.get<ServiceCategoryListResponse>("/api/service-categories");
  return res.data.data;
}
