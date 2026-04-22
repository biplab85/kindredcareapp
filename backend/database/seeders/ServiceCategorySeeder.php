<?php

namespace Database\Seeders;

use App\Models\ServiceCategory;
use Illuminate\Database\Seeder;

class ServiceCategorySeeder extends Seeder
{
    public function run(): void
    {
        $categories = [
            [
                'name' => 'Companionship',
                'slug' => 'companionship',
                'description' => 'Conversation, reading, hobbies, and social outings.',
                'icon' => 'Heart',
                'tier_required' => 'basic',
                'sort_order' => 1,
                'default_tasks' => [
                    'Arrived on time',
                    'Engaged in conversation',
                    'Participated in activity',
                    'Client was in good spirits',
                ],
            ],
            [
                'name' => 'Tech Help',
                'slug' => 'tech-help',
                'description' => 'Tablets, video calls, smart devices, and apps.',
                'icon' => 'Smartphone',
                'tier_required' => 'basic',
                'sort_order' => 2,
                'default_tasks' => [
                    'Device setup or troubleshooting',
                    'Taught new skill or feature',
                    'Resolved technical issue',
                    'Left device in working state',
                ],
            ],
            [
                'name' => 'Errands & Shopping',
                'slug' => 'errands-shopping',
                'description' => 'Groceries, prescriptions, and everyday errands.',
                'icon' => 'ShoppingBag',
                'tier_required' => 'basic',
                'sort_order' => 3,
                'default_tasks' => [
                    'Picked up requested items',
                    'Delivered to home',
                    'Put away items',
                    'Returned receipts and change',
                ],
            ],
            [
                'name' => 'Walking Companion',
                'slug' => 'walking-companion',
                'description' => 'Walks, light exercise, and fresh air together.',
                'icon' => 'Footprints',
                'tier_required' => 'basic',
                'sort_order' => 4,
                'default_tasks' => [
                    'Walked together safely',
                    'Monitored pace and comfort',
                    'Returned home safely',
                    'Noted any concerns',
                ],
            ],
            [
                'name' => 'Gardening',
                'slug' => 'gardening',
                'description' => 'Planting, weeding, watering, and yard care.',
                'icon' => 'Flower2',
                'tier_required' => 'basic',
                'sort_order' => 5,
                'default_tasks' => [
                    'Watered plants',
                    'Weeded garden beds',
                    'Planted or maintained',
                    'Cleaned up work area',
                ],
            ],
            [
                'name' => 'Meal Preparation',
                'slug' => 'meal-preparation',
                'description' => 'Nutritious meals tailored to dietary needs.',
                'icon' => 'ChefHat',
                'tier_required' => 'basic',
                'sort_order' => 6,
                'default_tasks' => [
                    'Prepared meal as requested',
                    'Followed dietary requirements',
                    'Cleaned kitchen after cooking',
                    'Stored leftovers properly',
                ],
            ],
            [
                'name' => 'Transportation',
                'slug' => 'transportation',
                'description' => 'Appointments, social visits, and errands.',
                'icon' => 'Car',
                'tier_required' => 'basic',
                'sort_order' => 7,
                'default_tasks' => [
                    'Picked up client on time',
                    'Drove safely to destination',
                    'Assisted with entry/exit',
                    'Dropped off on time',
                ],
            ],
            [
                'name' => 'Light Housekeeping',
                'slug' => 'light-housekeeping',
                'description' => 'Tidying, laundry, dishes, and organization.',
                'icon' => 'SprayCan',
                'tier_required' => 'basic',
                'sort_order' => 8,
                'default_tasks' => [
                    'Cleaned surfaces and floors',
                    'Did laundry',
                    'Washed dishes',
                    'Organized as requested',
                ],
            ],
        ];

        foreach ($categories as $category) {
            ServiceCategory::updateOrCreate(
                ['slug' => $category['slug']],
                $category,
            );
        }
    }
}
