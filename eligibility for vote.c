#include <stdio.h>
#include <string.h>

int main() {
    int num_candidates, num_voters;
    int i, j, choice;
    
    printf("===== Election System =====\n");

    // Input number of candidates
    printf("Enter number of candidates: ");
    scanf("%d", &num_candidates);

    char candidates[num_candidates][50];
    int votes[num_candidates];

    // Initialize votes
    for(i = 0; i < num_candidates; i++) {
        votes[i] = 0;
    }

    // Input candidate names
    for(i = 0; i < num_candidates; i++) {
        printf("Enter name of candidate %d: ", i + 1);
        scanf("%s", candidates[i]);
    }

    // Input number of voters
    printf("\nEnter number of voters: ");
    scanf("%d", &num_voters);

    // Voting process
    for(i = 1; i <= num_voters; i++) {
        printf("\nVoter %d\n", i);

        for(j = 0; j < num_candidates; j++) {
            printf("%d. %s\n", j + 1, candidates[j]);
        }

        printf("Enter your choice: ");
        scanf("%d", &choice);

        if(choice >= 1 && choice <= num_candidates) {
            votes[choice - 1]++;
        } else {
            printf("Invalid vote! Try again.\n");
            i--; // repeat voting
        }
    }

    // Display results
    printf("\n===== Election Results =====\n");
    for(i = 0; i < num_candidates; i++) {
        printf("%s: %d votes\n", candidates[i], votes[i]);
    }

    // Find winner
    int max = votes[0];
    int winner = 0;

    for(i = 1; i < num_candidates; i++) {
        if(votes[i] > max) {
            max = votes[i];
            winner = i;
        }
    }

    printf("\nWinner is %s with %d votes!\n", candidates[winner], max);

    return 0;
}