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
                'example_tasks' => [
                    'Chat over tea or coffee',
                    'Read a book or newspaper aloud',
                    'Play a card or board game',
                    'Visit a park, cafe, or local event',
                ],
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
                'example_tasks' => [
                    'Set up a tablet or smartphone',
                    'Help with video calls to family',
                    'Install and show how to use an app',
                    'Troubleshoot Wi-Fi or email issues',
                ],
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
                'example_tasks' => [
                    'Pick up groceries from a list',
                    'Collect prescriptions from the pharmacy',
                    'Drop off mail or packages',
                    'Run quick errands around town',
                ],
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
                'example_tasks' => [
                    'Accompany on a neighbourhood walk',
                    'Steady a walker or arm for balance',
                    'Go together to a nearby park',
                    'Encourage light, comfortable exercise',
                ],
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
                'example_tasks' => [
                    'Water plants and garden beds',
                    'Pull weeds and tidy borders',
                    'Plant flowers, herbs, or vegetables',
                    'Sweep paths and clean up clippings',
                ],
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
                'example_tasks' => [
                    'Cook a warm lunch or dinner',
                    'Prep a few meals for the week',
                    'Follow dietary needs (diabetic, low-salt, cultural)',
                    'Tidy the kitchen after cooking',
                ],
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
                'example_tasks' => [
                    'Drive to a medical appointment',
                    'Accompany on a social visit',
                    'Transport to a shopping trip',
                    'Help in and out of the vehicle',
                ],
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
                'example_tasks' => [
                    'Tidy common living areas',
                    'Run a load of laundry',
                    'Wash dishes and wipe counters',
                    'Organize mail or closets',
                ],
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
