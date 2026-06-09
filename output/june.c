#include <stdio.h>

int main()
{
    int one_back = 1, two_back = 0, newterm, n, i;

    printf("Enter number of terms: ");
    scanf("%d", &n);

    printf("%d\t%d\t", two_back, one_back);

    i = 3;

    while (i <= n)
    {
        newterm = one_back + two_back;
        printf("%d\t", newterm);

        two_back = one_back;
        one_back = newterm;

        i++;
    }

    return 0;
}
