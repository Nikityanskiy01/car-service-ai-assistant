export interface ServiceItem {
  id: string;
  title: string;
  description?: string;
  price?: string;
  category?: string;
  imageUrl?: string;
}

export type ServiceSort = 'default' | 'price-asc' | 'price-desc' | 'title';
