<?php

namespace Tests\Feature;

use App\Models\ServiceCategory;
use Database\Seeders\ServiceCategorySeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ServiceCategoryTest extends TestCase
{
    use RefreshDatabase;

    public function test_seeder_creates_all_mvp_categories(): void
    {
        $this->seed(ServiceCategorySeeder::class);

        $expectedSlugs = [
            'companionship',
            'tech-help',
            'errands-shopping',
            'walking-companion',
            'gardening',
            'meal-preparation',
            'transportation',
            'light-housekeeping',
        ];

        $this->assertSame(
            count($expectedSlugs),
            ServiceCategory::count(),
        );

        foreach ($expectedSlugs as $slug) {
            $category = ServiceCategory::where('slug', $slug)->first();
            $this->assertNotNull($category, "Missing category: {$slug}");
            $this->assertNotEmpty($category->name);
            $this->assertNotEmpty($category->description);
            $this->assertNotEmpty($category->icon);
            $this->assertIsArray($category->example_tasks);
            $this->assertGreaterThan(0, count($category->example_tasks));
            $this->assertIsArray($category->default_tasks);
            $this->assertGreaterThan(0, count($category->default_tasks));
        }
    }

    public function test_seeder_is_idempotent(): void
    {
        $this->seed(ServiceCategorySeeder::class);
        $firstCount = ServiceCategory::count();

        $this->seed(ServiceCategorySeeder::class);
        $this->assertSame($firstCount, ServiceCategory::count());
    }

    public function test_index_endpoint_returns_active_categories_in_sort_order(): void
    {
        $this->seed(ServiceCategorySeeder::class);

        ServiceCategory::where('slug', 'transportation')->update(['is_active' => false]);

        $response = $this->getJson('/api/service-categories');

        $response->assertOk();
        $response->assertJsonStructure([
            'data' => [
                '*' => [
                    'id',
                    'name',
                    'slug',
                    'description',
                    'icon',
                    'tier_required',
                    'example_tasks',
                    'default_tasks',
                    'sort_order',
                ],
            ],
        ]);

        $payload = $response->json('data');

        $this->assertSame(7, count($payload));
        $this->assertNotContains('transportation', array_column($payload, 'slug'));

        $sortOrders = array_column($payload, 'sort_order');
        $sorted = $sortOrders;
        sort($sorted);
        $this->assertSame($sorted, $sortOrders);
    }

    public function test_index_endpoint_is_public(): void
    {
        $this->seed(ServiceCategorySeeder::class);

        $response = $this->getJson('/api/service-categories');

        $response->assertOk();
        $this->assertNotEmpty($response->json('data'));
    }
}
